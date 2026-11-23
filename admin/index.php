<?php
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
?><!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#243a2f">
  <title>Seitenverwaltung | Oliver Eckstein</title>
  <link rel="stylesheet" href="admin.css">
  <script src="admin.js" defer></script>
</head>
<body>
  <main class="shell">
    <a class="brand" href="../index.html"><span>OE</span><b>Oliver Eckstein<small>SEITENVERWALTUNG</small></b></a>
    <section class="panel login-panel" id="login-panel">
      <p class="eyebrow">Interner Bereich</p><h1>Website verwalten</h1>
      <p>Melde dich an, um Texte, Trainingsangebote und Erfolge zu bearbeiten.</p>
      <form id="login-form"><label for="password">Passwort</label><input id="password" type="password" autocomplete="current-password" required><button type="submit">Anmelden <span aria-hidden="true">→</span></button></form>
      <p class="status" id="login-status" role="status"></p><a class="back" href="../index.html">← Zurück zur Website</a>
    </section>
    <section class="dashboard" id="dashboard" hidden>
      <header><div><p class="eyebrow">Inhalte bearbeiten</p><h1>Deine Website</h1></div><button class="secondary" id="logout" type="button">Abmelden</button></header>
      <p class="help">Ändere die Inhalte direkt hier. Mit „Änderungen veröffentlichen“ werden Website und gespeicherte Inhalte gemeinsam aktualisiert.</p>
      <div id="editor-root"><p>Lade deine Website-Inhalte …</p></div>
      <div class="save-bar"><p class="status" id="save-status" role="status"></p><button id="save-all" type="button">Änderungen veröffentlichen</button></div>
    </section>
  </main>
</body>
</html>
