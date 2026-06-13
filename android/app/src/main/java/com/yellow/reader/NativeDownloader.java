package com.yellow.reader;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import java.io.File;

public class NativeDownloader {
    private final Context context;
    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver;
    private String callbackName;

    public NativeDownloader(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public void download(String url, String filename) {
        File dir = new File(context.getExternalFilesDir(null), "updates");
        if (!dir.exists()) dir.mkdirs();
        File file = new File(dir, filename);
        if (file.exists()) file.delete();

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Yellow 更新");
        request.setDescription("正在下载新版本...");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(context, "updates", filename);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        request.setMimeType("application/vnd.android.package-archive");
        request.addRequestHeader("User-Agent", "YellowReader/1.0 Android");

        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        downloadId = dm.enqueue(request);

        if (downloadReceiver != null) {
            try { context.unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
        }

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;

                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                Cursor cursor = dm.query(query);

                if (cursor != null && cursor.moveToFirst()) {
                    int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    cursor.close();
                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        installApk(file);
                        notifyJs("completed");
                    } else {
                        notifyJs("failed");
                    }
                }

                try { context.unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
                downloadReceiver = null;
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }

        notifyJs("started");
    }

    @JavascriptInterface
    public int getProgress() {
        if (downloadId == -1) return -1;

        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = dm.query(query);

        if (cursor != null && cursor.moveToFirst()) {
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            cursor.close();

            if (status == DownloadManager.STATUS_SUCCESSFUL) return 100;
            if (status == DownloadManager.STATUS_FAILED) return -1;
            if (total > 0) return (int) (downloaded * 100 / total);
            return 0;
        }
        return -1;
    }

    private void installApk(File file) {
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
    }

    private void notifyJs(String status) {
        try {
            String js = "window.__nativeDownloadCallback && window.__nativeDownloadCallback('" + status + "')";
            if (context instanceof MainActivity) {
                ((MainActivity) context).runOnUiThread(() -> {
                    try {
                        ((MainActivity) context).getBridge().getWebView().evaluateJavascript(js, null);
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }
}
