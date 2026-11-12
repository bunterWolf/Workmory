const { execSync } = require('child_process');

function releaseBeta() {
    try {

        // 1. Stelle sicher, dass alles committed ist
        const status = execSync('git status --porcelain').toString();
        if (status) {
            console.error('❌ Du hast uncommitted changes. Bitte erst committen!');
            process.exit(1);
        }

        // 2. Prüfe, ob wir auf einem beta-Branch sind
        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        if (!branch.startsWith('beta') && !branch.startsWith('beta/')) {
            console.error('❌ Bitte wechsle erst zu einem beta-Branch (beta oder beta/*)!');
            console.error('   Beispiel: git checkout -b beta/v1.2.0 oder git checkout beta');
            process.exit(1);
        }

        // 3. Führe standard-version aus mit Beta-Flag
        console.log('📦 Erstelle neue Beta-Version...');
        // Über die CLI aufrufen: Nur sie liest die standard-version-Konfiguration aus package.json
        // (Build mit Tests vor dem Commit, Changelog-Abschnitte, Commit-Format).
        execSync('npx standard-version --prerelease beta', { stdio: 'inherit' });

        // 4. Hole die neue Version
        const version = require('../package.json').version;
        console.log(`✨ Neue Beta-Version: ${version}`);

        // 5. Pushe Changes und Tags zum aktuellen Branch
        console.log(`🚀 Pushe Changes und Tags zum ${branch} Branch...`);
        execSync(`git push --follow-tags origin ${branch}`);

        console.log(`
✅ Beta Release v${version} erstellt!

Die GitHub Action wird nun automatisch:
1. Die App bauen
2. Ein GitHub Pre-Release erstellen
3. Die Installer hochladen

Du kannst den Fortschritt hier verfolgen:
https://github.com/bunterWolf/Missing-Hours/actions

Beta-Tester können die neue Version über den Beta-Kanal erhalten.
Die Auto-Update-Funktion wird nur auf Geräten ausgeführt, die für Beta-Updates konfiguriert sind.

Hinweis zum Beta-Workflow:
1. Nach abgeschlossenem Beta-Testing kannst du den Branch in main mergen:
   git checkout main
   git merge ${branch}
   git push origin main
2. Dann kannst du einen stabilen Release erstellen:
   npm run release
        `);

    } catch (error) {
        console.error('❌ Fehler beim Beta-Release:', error.message);
        process.exit(1);
    }
}

releaseBeta(); 