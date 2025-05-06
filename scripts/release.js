const { execSync } = require('child_process');
const standardVersion = require('standard-version');

async function release() {
    try {
        // Setze die Umgebungsvariablen für electron-builder
        process.env.BETA_RELEASE = 'false';
        process.env.EP_PRE_RELEASE = 'false'; // Für electron-builder

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

        // 2. Führe standard-version aus
        console.log('📦 Erstelle neue Version...');
        await standardVersion({
            // Nutze die Konfiguration aus package.json
        });

        // 3. Hole die neue Version
        const version = require('../package.json').version;
        console.log(`✨ Neue Version: ${version}`);

        // 4. Pushe Changes und Tags
        console.log('🚀 Pushe Changes und Tags...');
        execSync('git push --follow-tags origin main');

        console.log(`
✅ Release v${version} erstellt!

Die GitHub Action wird nun automatisch:
1. Die App bauen
2. Ein GitHub Release erstellen
3. Die .exe hochladen

Du kannst den Fortschritt hier verfolgen:
https://github.com/bunterWolf/Chronflow/actions
        `);

    } catch (error) {
        console.error('❌ Fehler beim Release:', error.message);
        process.exit(1);
    }
}

release(); 