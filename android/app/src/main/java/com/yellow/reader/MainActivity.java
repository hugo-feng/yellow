package com.yellow.reader;

import android.os.Bundle;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Clear WebView and SW caches before Capacitor loads
        // This ensures new APK assets are always loaded
        clearWebViewCaches();

        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        getBridge().getWebView().addJavascriptInterface(
            new NativeDownloader(this), "NativeDownloader"
        );
    }

    private void clearWebViewCaches() {
        try {
            // Delete ServiceWorker cache directory
            File swCache = new File(getApplicationInfo().dataDir, "app_webview/Service Worker/CacheStorage");
            if (swCache.exists()) {
                deleteRecursive(swCache);
                Log.d(TAG, "Cleared SW CacheStorage");
            }

            // Delete WebView HTTP cache
            File httpCache = new File(getApplicationInfo().dataDir, "app_webview/Cache");
            if (httpCache.exists()) {
                deleteRecursive(httpCache);
                Log.d(TAG, "Cleared WebView HTTP cache");
            }

            // Delete code cache
            File codeCache = new File(getApplicationInfo().dataDir, "app_webview/Code Cache");
            if (codeCache.exists()) {
                deleteRecursive(codeCache);
                Log.d(TAG, "Cleared WebView code cache");
            }
        } catch (Exception e) {
            Log.e(TAG, "clearWebViewCaches failed", e);
        }
    }

    private void deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        file.delete();
    }
}
