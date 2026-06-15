package com.yellow.reader;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.util.Log;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NativeDownloader {
    private static final String TAG = "NativeDownloader";
    private final Context context;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean downloading = false;
    private volatile int progress = 0;
    private File lastDownloadedFile = null;
    private volatile boolean cancelled = false;

    public NativeDownloader(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public void download(String url, String filename, String version) {
        Log.d(TAG, "download: " + url);
        cancelled = false;
        downloading = true;
        progress = 0;

        File dir = new File(context.getExternalFilesDir(null), "updates");
        if (!dir.exists()) dir.mkdirs();
        File file = new File(dir, filename);
        if (file.exists()) file.delete();

        executor.execute(() -> {
            try {
                // Resolve redirect first
                String finalUrl = resolveRedirect(url);
                Log.d(TAG, "final url: " + finalUrl);

                HttpURLConnection conn = (HttpURLConnection) new URL(finalUrl).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "YellowReader/1.0 Android");
                conn.setInstanceFollowRedirects(true);
                conn.connect();

                int code = conn.getResponseCode();
                Log.d(TAG, "response: " + code);
                if (code != 200 && code != 302) {
                    notifyJs("failed");
                    downloading = false;
                    conn.disconnect();
                    return;
                }

                // Follow redirect if needed
                if (code == 302 || code == 301) {
                    String location = conn.getHeaderField("Location");
                    conn.disconnect();
                    conn = (HttpURLConnection) new URL(location).openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "YellowReader/1.0 Android");
                    conn.connect();
                }

                int totalSize = conn.getContentLength();
                Log.d(TAG, "totalSize: " + totalSize);

                InputStream is = conn.getInputStream();
                FileOutputStream fos = new FileOutputStream(file);
                byte[] buffer = new byte[8192];
                int bytesRead;
                int downloaded = 0;
                int lastReported = -1;

                while ((bytesRead = is.read(buffer)) != -1) {
                    if (cancelled) {
                        Log.d(TAG, "download cancelled");
                        fos.flush(); fos.close(); is.close(); conn.disconnect();
                        if (file.exists()) file.delete();
                        downloading = false;
                        return;
                    }
                    fos.write(buffer, 0, bytesRead);
                    downloaded += bytesRead;
                    if (totalSize > 0) {
                        progress = (int) (downloaded * 100 / totalSize);
                        if (progress != lastReported) {
                            lastReported = progress;
                            notifyJs("progress:" + progress);
                        }
                    }
                }

                fos.flush();
                fos.close();
                is.close();
                conn.disconnect();

                progress = 100;
                downloading = false;
                lastDownloadedFile = file;
                notifyJs("completed");
                Log.d(TAG, "download complete, size=" + file.length());

                new Handler(Looper.getMainLooper()).postDelayed(() -> installApk(file), 500);

            } catch (Exception e) {
                Log.e(TAG, "download failed", e);
                downloading = false;
                progress = -1;
                notifyJs("failed:" + e.getMessage());
            }
        });
    }

    private String resolveRedirect(String urlStr) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("User-Agent", "YellowReader/1.0 Android");
            int code = conn.getResponseCode();
            if (code == 301 || code == 302) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                return location;
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "resolveRedirect failed", e);
        }
        return urlStr;
    }

    @JavascriptInterface
    public int getProgress() {
        return progress;
    }

    @JavascriptInterface
    public boolean isDownloading() {
        return downloading;
    }

    @JavascriptInterface
    public void cancel() {
        Log.d(TAG, "cancel download");
        cancelled = true;
        downloading = false;
        progress = -1;
        File dir = new File(context.getExternalFilesDir(null), "updates");
        if (dir.exists()) {
            for (File f : dir.listFiles()) {
                if (f.getName().endsWith(".apk")) f.delete();
            }
        }
    }

    @JavascriptInterface
    public boolean install() {
        if (lastDownloadedFile != null && lastDownloadedFile.exists()) {
            new Handler(Looper.getMainLooper()).post(() -> installApk(lastDownloadedFile));
            return true;
        }
        return false;
    }

    private void installApk(File file) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
            }
            context.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "installApk failed", e);
        }
    }

    private void notifyJs(String status) {
        try {
            String escaped = status.replace("'", "\\'");
            String js = "window.__nativeDownloadCallback && window.__nativeDownloadCallback('" + escaped + "')";
            if (context instanceof MainActivity) {
                ((MainActivity) context).runOnUiThread(() -> {
                    try {
                        ((MainActivity) context).getBridge().getWebView().evaluateJavascript(js, null);
                    } catch (Exception e) {
                        Log.e(TAG, "notifyJs failed", e);
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "notifyJs failed", e);
        }
    }
}
