/**
 * Test Firebase Data Access
 * Verifies that all migrated data can be read from Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

/**
 * Test reading products collection
 */
async function testProductsCollection() {
  console.log('📦 Testing products collection...');
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    console.log(`   ✅ Found ${snapshot.size} products`);
    
    snapshot.forEach((doc) => {
      const product = doc.data();
      console.log(`   - ${product.name}: $${product.price} (ID: ${doc.id})`);
    });
    
    return snapshot.size;
  } catch (error) {
    console.error('   ❌ Error reading products:', error.message);
    return 0;
  }
}

/**
 * Test reading configuration documents
 */
async function testConfigDocument(path, description) {
  console.log(`📄 Testing ${description}...`);
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`   ✅ Document found with ${Object.keys(data).length} properties`);
      console.log(`   - Sample keys: ${Object.keys(data).slice(0, 3).join(', ')}`);
      return true;
    } else {
      console.log(`   ❌ Document not found at path: ${path}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error reading ${description}:`, error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runFirebaseTests() {
  console.log('🔥 Starting Firebase Data Tests...\n');
  
  const results = {
    products: 0,
    documents: 0,
    total: 0
  };
  
  // Test products collection
  results.products = await testProductsCollection();
  console.log('');
  
  // Test configuration documents
  const configTests = [
    { path: 'pricing/tiers', description: 'pricing tiers configuration' },
    { path: 'shipping/config', description: 'shipping configuration' },
    { path: 'payment/config', description: 'payment configuration' },
    { path: 'admin/emails', description: 'admin emails configuration' },
    { path: 'templates/email-config', description: 'email templates configuration' },
    { path: 'integrations/connections', description: 'integration connections' }
  ];
  
  for (const test of configTests) {
    const success = await testConfigDocument(test.path, test.description);
    if (success) results.documents++;
    console.log('');
  }
  
  results.total = results.products + results.documents;
  
  // Test summary
  console.log('🎉 Firebase Data Test Results:');
  console.log('=' .repeat(50));
  console.log(`📦 Products found: ${results.products}`);
  console.log(`📄 Config documents found: ${results.documents}/${configTests.length}`);
  console.log(`📈 Total data sources: ${results.total}/${configTests.length + 1}`);
  
  if (results.total === configTests.length + 1) {
    console.log('✅ All Firebase data accessible - Migration successful!');
  } else {
    console.log('⚠️ Some data may be missing - Check Firebase Console');
  }
  
  console.log('\n🌐 Firebase Console: https://console.firebase.google.com/project/kanvaportal/firestore');
}

// Run tests if script is executed directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this script is being run directly
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  runFirebaseTests().catch(console.error);
}

export { runFirebaseTests };
