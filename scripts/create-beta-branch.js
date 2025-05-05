const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createBetaBranch() {
  try {
    // 1. Prüfen, ob wir auf dem develop-Branch sind
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    
    if (currentBranch !== 'develop') {
      console.log('❓ Du bist nicht auf dem develop-Branch. Aktuelle Branch:', currentBranch);
      
      const answer = await new Promise(resolve => {
        rl.question('Möchtest du trotzdem fortfahren? (j/n) ', resolve);
      });
      
      if (answer.toLowerCase() !== 'j') {
        console.log('❌ Abgebrochen. Bitte zum develop-Branch wechseln: git checkout develop');
        process.exit(0);
      }
    }
    
    // 2. Sicherstellen, dass alle Änderungen committed sind
    const status = execSync('git status --porcelain').toString();
    if (status) {
      console.error('❌ Du hast uncommitted changes. Bitte erst committen!');
      process.exit(1);
    }
    
    // 3. develop aktualisieren
    console.log('📥 Aktualisiere den lokalen develop-Branch...');
    execSync('git fetch origin');
    
    if (currentBranch === 'develop') {
      execSync('git pull origin develop');
    }
    
    // 4. Bestimmung der nächsten Version aus package.json
    const packageJson = require('../package.json');
    const currentVersion = packageJson.version;
    console.log('ℹ️ Aktuelle Version:', currentVersion);
    
    // Vorschlag für Beta-Branch-Name
    let nextVersion = currentVersion.split('.');
    nextVersion[2] = parseInt(nextVersion[2]) + 1; // Inkrementiere Patch-Version
    nextVersion = nextVersion.join('.');
    
    // 5. Beta-Branch-Name abfragen
    const suggestedBranchName = `beta/v${nextVersion}`;
    const branchName = await new Promise(resolve => {
      rl.question(`Beta-Branch-Name (Standard: ${suggestedBranchName}): `, answer => {
        resolve(answer || suggestedBranchName);
      });
    });
    
    // 6. Beta-Branch erstellen
    console.log(`🔄 Erstelle Beta-Branch: ${branchName}...`);
    execSync(`git checkout -b ${branchName} ${currentBranch}`);
    
    // 7. Push zum Remote
    const shouldPush = await new Promise(resolve => {
      rl.question('Möchtest du den Branch direkt pushen? (j/n) ', answer => {
        resolve(answer.toLowerCase() === 'j');
      });
    });
    
    if (shouldPush) {
      console.log(`🚀 Pushe Branch ${branchName} zu origin...`);
      execSync(`git push -u origin ${branchName}`);
    }
    
    console.log(`
✅ Beta-Branch ${branchName} wurde erfolgreich erstellt!

Nächste Schritte:
1. Nimm alle notwendigen letzten Änderungen für die Beta vor
2. Committe die Änderungen
3. Führe dann "npm run release:beta" aus, um ein Beta-Release zu erstellen
    `);
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Beta-Branches:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createBetaBranch(); 