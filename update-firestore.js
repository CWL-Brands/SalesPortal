const admin = require('firebase-admin');
const serviceAccount = require('./functions/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateRingCentralConfig() {
  try {
    const docRef = db.collection('integrations').doc('connections');
    
    // Get current document data
    const doc = await docRef.get();
    const currentData = doc.exists ? doc.data() : {};
    
    // Update RingCentral config
    const updatedData = {
      ...currentData,
      ringcentral: {
        ...currentData.ringcentral,
        clientId: 'your_ringcentral_app_client_id', // Replace with actual client ID
        environment: 'production',
        redirectUri: 'https://kanvaportal.web.app/rc/auth/callback'
      }
    };
    
    // Update the document
    await docRef.set(updatedData, { merge: true });
    console.log('Successfully updated RingCentral configuration in Firestore');
    
    // Verify the update
    const updatedDoc = await docRef.get();
    console.log('Updated document:', JSON.stringify(updatedDoc.data(), null, 2));
    
  } catch (error) {
    console.error('Error updating Firestore:', error);
  } finally {
    process.exit();
  }
}

updateRingCentralConfig();
