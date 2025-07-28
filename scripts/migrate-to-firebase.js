// Firebase Data Migration Script
// Migrates all data from local JSON files to Firebase Firestore

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q",
  authDomain: "kanvaportal.firebaseapp.com",
  projectId: "kanvaportal",
  storageBucket: "kanvaportal.firebasestorage.app",
  messagingSenderId: "829835149823",
  appId: "1:829835149823:web:500d938c7c6ed3addf67ca",
  measurementId: "G-TBJY8JPTTN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Migration mapping configuration
const migrationConfig = [
  {
    localFile: 'products.json',
    firebasePath: 'products',
    isCollection: true,
    description: 'Product catalog with pricing and specifications'
  },
  {
    localFile: 'tiers.json',
    firebasePath: 'pricing/tiers',
    isCollection: false,
    description: 'Pricing tier configuration'
  },
  {
    localFile: 'shipping.json',
    firebasePath: 'shipping/config',
    isCollection: false,
    description: 'Shipping zones and rates configuration'
  },
  {
    localFile: 'payment.json',
    firebasePath: 'payment/config',
    isCollection: false,
    description: 'Payment methods and processing configuration'
  },
  {
    localFile: 'admin-emails.json',
    firebasePath: 'admin/emails',
    isCollection: false,
    description: 'Admin notification email addresses'
  },
  {
    localFile: 'email-templates.json',
    firebasePath: 'templates/email-config',
    isCollection: false,
    description: 'Email template configurations'
  },
  {
    localFile: 'connections.example.json',
    firebasePath: 'integrations/connections',
    isCollection: false,
    description: 'Integration connection examples (will create empty structure)'
  }
];

/**
 * Load JSON data from local file
 */
function loadLocalData(filename) {
  try {
    const filePath = join(__dirname, '..', 'data', filename);
    const fileContent = readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Failed to load ${filename}:`, error.message);
    return null;
  }
}

/**
 * Migrate collection data to Firebase
 */
async function migrateCollection(data, firebasePath) {
  const batch = [];
  let count = 0;

  for (const [key, value] of Object.entries(data)) {
    const docRef = doc(db, firebasePath, key);
    const docData = {
      ...value,
      migratedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    batch.push(setDoc(docRef, docData));
    count++;
  }

  await Promise.all(batch);
  return count;
}

/**
 * Migrate document data to Firebase
 */
async function migrateDocument(data, firebasePath) {
  const docRef = doc(db, firebasePath);
  const docData = {
    ...data,
    migratedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  await setDoc(docRef, docData);
  return 1;
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🔥 Starting Firebase data migration...\n');
  
  let totalMigrated = 0;
  const results = [];

  for (const config of migrationConfig) {
    console.log(`📂 Migrating ${config.localFile}...`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Firebase Path: ${config.firebasePath}`);
    console.log(`   Type: ${config.isCollection ? 'Collection' : 'Document'}`);

    try {
      // Load local data
      const localData = loadLocalData(config.localFile);
      
      if (!localData) {
        console.log(`   ⚠️ Skipping ${config.localFile} - file not found or invalid\n`);
        results.push({
          file: config.localFile,
          status: 'skipped',
          reason: 'File not found or invalid'
        });
        continue;
      }

      // Handle special case for connections.example.json
      if (config.localFile === 'connections.example.json') {
        // Create empty connections structure instead of using example
        const emptyConnections = {
          github: { enabled: false },
          copper: { enabled: false },
          fishbowl: { enabled: false },
          lastUpdated: new Date().toISOString()
        };
        
        await migrateDocument(emptyConnections, config.firebasePath);
        console.log(`   ✅ Created empty connections structure\n`);
        
        results.push({
          file: config.localFile,
          status: 'success',
          count: 1,
          firebasePath: config.firebasePath
        });
        totalMigrated += 1;
        continue;
      }

      // Migrate data
      let count;
      if (config.isCollection) {
        count = await migrateCollection(localData, config.firebasePath);
      } else {
        count = await migrateDocument(localData, config.firebasePath);
      }

      console.log(`   ✅ Successfully migrated ${count} items\n`);
      
      results.push({
        file: config.localFile,
        status: 'success',
        count: count,
        firebasePath: config.firebasePath
      });
      
      totalMigrated += count;

    } catch (error) {
      console.error(`   ❌ Failed to migrate ${config.localFile}:`, error.message);
      console.error(`   Error details:`, error);
      
      results.push({
        file: config.localFile,
        status: 'error',
        error: error.message
      });
    }
  }

  // Migration summary
  console.log('🎉 Migration completed!\n');
  console.log('📊 MIGRATION SUMMARY:');
  console.log('=' .repeat(50));
  
  results.forEach(result => {
    const status = result.status === 'success' ? '✅' : 
                  result.status === 'skipped' ? '⚠️' : '❌';
    
    console.log(`${status} ${result.file}`);
    if (result.status === 'success') {
      console.log(`   → ${result.firebasePath} (${result.count} items)`);
    } else if (result.status === 'error') {
      console.log(`   → Error: ${result.error}`);
    } else {
      console.log(`   → ${result.reason}`);
    }
  });
  
  console.log('=' .repeat(50));
  console.log(`📈 Total items migrated: ${totalMigrated}`);
  console.log(`✅ Successful migrations: ${results.filter(r => r.status === 'success').length}`);
  console.log(`❌ Failed migrations: ${results.filter(r => r.status === 'error').length}`);
  console.log(`⚠️ Skipped migrations: ${results.filter(r => r.status === 'skipped').length}`);
  
  console.log('\n🔥 Firebase migration complete!');
  console.log('🌐 You can now view your data at: https://console.firebase.google.com/project/kanvaportal/firestore');
}

// Run migration if this script is executed directly
// Fixed execution detection for ES modules
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule || process.argv[1]?.endsWith('migrate-to-firebase.js')) {
  console.log('🚀 Starting migration script...');
  
  runMigration()
    .then(() => {
      console.log('\n✨ Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      console.error('Error details:', error.stack);
      process.exit(1);
    });
} else {
  console.log('📦 Migration script loaded as module');
}

export { runMigration };
