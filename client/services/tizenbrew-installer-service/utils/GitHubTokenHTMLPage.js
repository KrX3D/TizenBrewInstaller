// Page a phone or PC opens (via the QR code in the installer) to hand over a
// GitHub token. English and German, picked from the browser language.
const gitHubTokenHtmlPage = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>GitHub token - TizenBrew Installer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #1e293b; color: #e2e8f0; font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .card { max-width: 520px; margin: 0 auto; background: #0f172a; border-radius: 16px; padding: 20px; }
        h1 { font-size: 22px; color: #a78bfa; margin-top: 0; }
        p, li { line-height: 1.5; color: #cbd5e1; }
        a.button, button { display: block; width: 100%; box-sizing: border-box; text-align: center; padding: 14px; margin: 12px 0; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; text-decoration: none; }
        a.button { background: #334155; color: #fff; }
        button { background: #7c3aed; color: #fff; }
        input { width: 100%; box-sizing: border-box; padding: 14px; border-radius: 10px; border: 1px solid #475569; background: #1e293b; color: #fff; font-size: 16px; }
        #status { min-height: 1.5em; font-weight: bold; }
        .ok { color: #34d399; } .err { color: #f87171; }
    </style>
</head>
<body>
<div class="card">
    <h1 data-t="title"></h1>
    <p data-t="intro"></p>
    <ol>
        <li data-t="step1"></li>
        <li data-t="step2"></li>
        <li data-t="step3"></li>
    </ol>
    <a class="button" target="_blank" rel="noopener" href="https://github.com/settings/personal-access-tokens/new?name=TizenBrew%20Installer&description=Raises%20the%20GitHub%20API%20limit%20for%20the%20TizenBrew%20Installer" data-t="create"></a>
    <input id="token" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="github_pat_... / ghp_...">
    <input id="pin" type="text" inputmode="numeric" maxlength="4" autocomplete="off" style="display:none;margin-top:12px">
    <button id="save" data-t="save"></button>
    <p id="status"></p>
</div>
<script>
    var de = /^de/i.test(navigator.language || '');
    var T = de ? {
        title: 'GitHub-Token für TizenBrew Installer',
        intro: 'Ohne Token erlaubt GitHub nur 60 Anfragen pro Stunde. Mit Token sind es 5000.',
        step1: 'Auf "Token auf GitHub erstellen" tippen und bei GitHub anmelden.',
        step2: 'Ablaufdatum wählen, "Public repositories" lassen, keine weiteren Rechte nötig. "Generate token" tippen.',
        step3: 'Token kopieren, unten einfügen und "Auf TV speichern" tippen.',
        create: 'Token auf GitHub erstellen',
        save: 'Auf TV speichern',
        empty: 'Bitte zuerst einen Token einfügen.',
        sending: 'Wird gesendet...',
        done: 'Gespeichert. Der Token ist jetzt auf dem TV, diese Seite kann geschlossen werden.',
        failed: 'Fehler: ',
        pinHint: 'PIN vom TV (4 Ziffern)'
    } : {
        title: 'GitHub token for TizenBrew Installer',
        intro: 'Without a token GitHub allows only 60 requests per hour. With one it allows 5000.',
        step1: 'Tap "Create token on GitHub" and sign in to GitHub.',
        step2: 'Pick an expiry, keep "Public repositories", no other permissions are needed. Tap "Generate token".',
        step3: 'Copy the token, paste it below and tap "Save on TV".',
        create: 'Create token on GitHub',
        save: 'Save on TV',
        empty: 'Paste a token first.',
        sending: 'Sending...',
        done: 'Saved. The token is on the TV now, you can close this page.',
        failed: 'Error: ',
        pinHint: 'PIN shown on the TV (4 digits)'
    };
    var nodes = document.querySelectorAll('[data-t]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = T[nodes[i].getAttribute('data-t')];
    var pinMatch = /[?&]pin=(\\d+)/.exec(location.search);
    var pinInput = document.getElementById('pin');
    pinInput.placeholder = T.pinHint;
    if (pinMatch) pinInput.value = pinMatch[1]; else pinInput.style.display = 'block';
    var status = document.getElementById('status');
    document.getElementById('save').addEventListener('click', function () {
        var token = document.getElementById('token').value.trim();
        status.className = '';
        if (!token) { status.className = 'err'; status.textContent = T.empty; return; }
        status.textContent = T.sending;
        var xhr = new XMLHttpRequest();
        xhr.open('POST', location.pathname);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onload = function () {
            var res = {};
            try { res = JSON.parse(xhr.responseText); } catch (e) {}
            if (xhr.status === 200 && res.ok) {
                status.className = 'ok';
                status.textContent = T.done;
                document.getElementById('token').value = '';
            } else {
                status.className = 'err';
                status.textContent = T.failed + (res.error || ('HTTP ' + xhr.status));
            }
        };
        xhr.onerror = function () { status.className = 'err'; status.textContent = T.failed + 'network'; };
        xhr.send('token=' + encodeURIComponent(token) + '&pin=' + encodeURIComponent(pinInput.value.trim()));
    });
</script>
</body>
</html>
`;

module.exports = gitHubTokenHtmlPage;
