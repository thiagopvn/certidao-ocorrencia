// firebase-config.js

// 🔥 Configuração do seu Firebase
var firebaseConfig = {
  apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
  authDomain: "certidao-gocg.firebaseapp.com",
  databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com",
  projectId: "certidao-gocg",
  storageBucket: "certidao-gocg.firebasestorage.app",
  messagingSenderId: "684546571684",
  appId: "1:684546571684:web:c104197a7c6b1c9f7a5531",
  measurementId: "G-YZHFGW74Y7",
};

// ✅ Inicializa Firebase apenas uma vez
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("🔥 Firebase inicializado via firebase-config.js");
} else {
  console.log("⚠️ Firebase já estava inicializado");
}

// ✅ Exporta para uso global nos outros scripts
window.db = firebase.database();
window.storage = firebase.storage();
window.functions = firebase.functions();
