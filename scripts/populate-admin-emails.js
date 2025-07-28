/**
 * Populate Admin Emails Collection in Firestore
 * Adds the required admin email addresses to the admin/emails document
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

// Admin email configuration
const adminEmailsData = {
  emails: [
    "ben@kanvabotanicals.com",
    "admin@kanvabotanicals.com"
  ],
  lastUpdated: new Date().toISOString(),
  createdAt: new Date(),
  updatedAt: new Date(),
  description: "Admin notification email addresses for Kanva Quotes system"
};

/**
 * Populate admin emails collection
 */
async function populateAdminEmails() {
  try {
    console.log('📧 Populating admin emails collection in Firestore...');
    
    // Reference to admin/emails document
    const adminEmailsRef = doc(db, 'admin/emails');
    
    // Set the document data
    await setDoc(adminEmailsRef, adminEmailsData, { merge: true });
    
    console.log('✅ Successfully populated admin emails collection');
    console.log(`📧 Added ${adminEmailsData.emails.length} admin emails:`);
    adminEmailsData.emails.forEach(email => {
      console.log(`   - ${email}`);
    });
    
    console.log('\n🔥 Admin emails are now available in Firestore');
    console.log('🎛️ Admin dashboard should now show admin emails');
    
    return {
      success: true,
      emailCount: adminEmailsData.emails.length,
      emails: adminEmailsData.emails
    };
    
  } catch (error) {
    console.error('❌ Failed to populate admin emails:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the population function
console.log('🚀 Starting admin emails population script...');
populateAdminEmails()
  .then(result => {
    if (result.success) {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Script failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });

export { populateAdminEmails };
