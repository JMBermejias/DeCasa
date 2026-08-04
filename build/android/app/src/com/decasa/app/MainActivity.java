package com.decasa.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {

    private static final String PREFS = "decasa";
    private static final String KEY_URL = "server_url";
    private static final String DEFAULT_URL = "http://192.168.1.100:4000";

    private WebView web;
    private ProgressBar progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(56, 189, 248)));
        progress.setVisibility(View.GONE);
        root.addView(progress, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(4)));
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        String url = prefs().getString(KEY_URL, "");
        if (url.isEmpty()) {
            promptUrl(true);
        } else {
            web.loadUrl(url);
        }
    }

    private int dp(int v) {
        return Math.round(getResources().getDisplayMetrics().density * v);
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void promptUrl(boolean firstRun) {
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        String cur = prefs().getString(KEY_URL, DEFAULT_URL);
        if (!cur.isEmpty()) input.setText(cur);

        AlertDialog.Builder b = new AlertDialog.Builder(this);
        b.setTitle(firstRun ? "Bienvenido a DeCasa" : "Cambiar servidor DeCasa");
        b.setMessage("Introduce la URL del servidor DeCasa (web, red local o remota):");
        b.setView(input);
        b.setPositiveButton("Conectar", (d, w) -> {
            String url = input.getText().toString().trim();
            if (url.isEmpty()) {
                web.loadUrl(DEFAULT_URL);
                return;
            }
            if (!url.startsWith("http")) url = "http://" + url;
            prefs().edit().putString(KEY_URL, url).apply();
            web.loadUrl(url);
        });
        if (firstRun) {
            b.setNegativeButton("Usar por defecto", (d, w) -> {
                prefs().edit().putString(KEY_URL, DEFAULT_URL).apply();
                web.loadUrl(DEFAULT_URL);
            });
        } else {
            b.setNegativeButton("Cancelar", null);
        }
        b.setCancelable(!firstRun);
        b.show();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "Cambiar servidor");
        menu.add(0, 2, 0, "Recargar");
        menu.add(0, 3, 0, "Salir");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case 1:
                promptUrl(false);
                return true;
            case 2:
                web.reload();
                return true;
            case 3:
                finish();
                return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
