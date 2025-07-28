/**
 * Upload Product Images to Firebase Storage
 * Maps existing product render images to Firebase Storage for admin dashboard
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
const storage = getStorage(app);

// Product image mapping (based on existing product renders)
const productImageMapping = {
  '1': 'Kanva_focus+flow_Box_Bottle_Master_4_30.png',
  '2': 'Kanva_Release+Relax_Box_Bottle_Master_4_30_v2.png', 
  '3': 'Kanva_ZOOM_Bottle_Box_4_30.png',
  '4': 'Kanva_Mango_3d_Display_Box_4_30.png',
  '5': 'Kanva_RAW+Releaf_DisplayBox.png'
};

/**
 * Upload a single product image to Firebase Storage
 */
async function uploadProductImage(productId, filename) {
  try {
    console.log(`📤 Uploading image for product ${productId}: ${filename}`);
    
    // Read the image file
    const imagePath = join(__dirname, '..', 'assets', 'product_renders', filename);
    const imageBuffer = readFileSync(imagePath);
    
    // Create storage reference
    const imageRef = ref(storage, `product-images/${productId}.png`);
    
    // Upload the image
    const snapshot = await uploadBytes(imageRef, imageBuffer, {
      contentType: 'image/png'
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✅ Successfully uploaded ${filename} for product ${productId}`);
    console.log(`🔗 Download URL: ${downloadURL}`);
    
    return {
      productId,
      filename,
      downloadURL,
      success: true
    };
    
  } catch (error) {
    console.error(`❌ Failed to upload image for product ${productId}:`, error.message);
    return {
      productId,
      filename,
      error: error.message,
      success: false
    };
  }
}

/**
 * Upload all product images
 */
async function uploadAllProductImages() {
  console.log('🚀 Starting product image upload to Firebase Storage...\n');
  
  const results = [];
  
  for (const [productId, filename] of Object.entries(productImageMapping)) {
    const result = await uploadProductImage(productId, filename);
    results.push(result);
    console.log(''); // Add spacing between uploads
  }
  
  // Summary
  console.log('📊 UPLOAD SUMMARY:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful uploads: ${successful.length}`);
  console.log(`❌ Failed uploads: ${failed.length}`);
  console.log(`📈 Total images processed: ${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successfully uploaded images:');
    successful.forEach(r => {
      console.log(`   - Product ${r.productId}: ${r.filename}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    failed.forEach(r => {
      console.log(`   - Product ${r.productId}: ${r.error}`);
    });
  }
  
  console.log('\n🔥 Product image upload complete!');
  console.log('🌐 Images are now available in Firebase Storage');
  console.log('🎛️ Admin dashboard should now display product images');
  
  return results;
}

// Run the upload function
console.log('🚀 Starting product images upload script...');
uploadAllProductImages()
  .then(result => {
    if (result && result.success) {
      console.log('🎉 Image upload script completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Image upload script failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error in image upload:', error);
    process.exit(1);
  });

export { uploadAllProductImages };
