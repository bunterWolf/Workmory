const { execSync } = require('child_process');
const standardVersion = require('standard-version');

async function releaseBeta() {
    try {
        // 1. Stelle sicher, dass wir auf main sind und alles committed ist
        const status = execSync('git status --porcelain').toString();
        if (status) {
            console.error('❌ Du hast uncommitted changes. Bitte erst committen!');
            process.exit(1);
        }

        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        if (branch !== 'main') {
            console.error('❌ Bitte wechsle erst zum main branch!');
            process.exit(1);
        }

        // 2. Führe standard-version aus mit Beta-Flag
        console.log('📦 Erstelle neue Beta-Version...');
        await standardVersion({
            prerelease: 'beta',
            skip: {
                changelog: false
            }
        });

        // 3. Hole die neue Version
        const version = require('../package.json').version;
        console.log(`✨ Neue Beta-Version: ${version}`);

        // 4. Pushe Changes und Tags
        console.log('🚀 Pushe Changes und Tags...');
        execSync('git push --follow-tags origin main');

        console.log(`
✅ Beta Release v${version} erstellt!

Die GitHub Action wird nun automatisch:
1. Die App bauen
2. Ein GitHub Pre-Release erstellen
3. Die Installer hochladen

Du kannst den Fortschritt hier verfolgen:
https://github.com/bunterWolf/Chronflow/actions

Beta-Tester können die neue Version über den Beta-Kanal erhalten.
Die Auto-Update-Funktion wird nur auf Geräten ausgeführt, die für Beta-Updates konfiguriert sind.
        `);

    } catch (error) {
        console.error('❌ Fehler beim Beta-Release:', error.message);
        process.exit(1);
    }
}

releaseBeta(); 