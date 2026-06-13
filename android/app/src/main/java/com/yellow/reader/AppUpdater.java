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
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;

@CapacitorPlugin(
    name = "AppUpdater",
    permissions = {
        @Permission(
            alias = "download",
            strings = { android.Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class AppUpdater extends Plugin {
    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver;
    private static final String DOWNLOAD_DIR = "updates";

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename", "yellow-update.apk");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        Context ctx = getContext();
        File dir = new File(ctx.getExternalFilesDir(null), DOWNLOAD_DIR);
        if (!dir.exists()) dir.mkdirs();
        File file = new File(dir, filename);
        if (file.exists()) file.delete();

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Yellow 更新");
        request.setDescription("正在下载新版本...");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(ctx, DOWNLOAD_DIR, filename);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);

        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        downloadId = dm.enqueue(request);

        if (downloadReceiver != null) {
            try { ctx.unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
        }

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;

                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                Cursor cursor = dm.query(query);

                if (cursor != null && cursor.moveToFirst()) {
                    int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        cursor.close();
                        installApk(context, file);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    } else {
                        int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                        cursor.close();
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", "Download failed, reason: " + reason);
                        call.resolve(ret);
                    }
                }

                try { context.unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
                downloadReceiver = null;
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getProgress(PluginCall call) {
        if (downloadId == -1) {
            JSObject ret = new JSObject();
            ret.put("status", "idle");
            ret.put("progress", 0);
            call.resolve(ret);
            return;
        }

        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = dm.query(query);

        if (cursor != null && cursor.moveToFirst()) {
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            cursor.close();

            JSObject ret = new JSObject();
            switch (status) {
                case DownloadManager.STATUS_RUNNING:
                case DownloadManager.STATUS_PAUSED:
                    ret.put("status", "downloading");
                    ret.put("progress", total > 0 ? (int) (downloaded * 100 / total) : 0);
                    ret.put("downloaded", downloaded);
                    ret.put("total", total);
                    break;
                case DownloadManager.STATUS_SUCCESSFUL:
                    ret.put("status", "completed");
                    ret.put("progress", 100);
                    break;
                case DownloadManager.STATUS_FAILED:
                    ret.put("status", "failed");
                    ret.put("progress", 0);
                    break;
                default:
                    ret.put("status", "pending");
                    ret.put("progress", 0);
            }
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("status", "completed");
            ret.put("progress", 100);
            call.resolve(ret);
        }
    }

    private void installApk(Context context, File file) {
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
}
