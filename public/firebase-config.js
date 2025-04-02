window.firebaseConfig = {
  apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
  authDomain: "certidao-gocg.firebaseapp.com",
  projectId: "certidao-gocg",
  storageBucket: "certidao-gocg.firebasestorage.app",
  messagingSenderId: "684546571684",
  appId: "1:684546571684:web:c104197a7c6b1c9f7a5531",
  measurementId: "G-YZHFGW74Y7",
  databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com/",
};

// Inicializar Firebase APENAS SE ainda não foi inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(window.firebaseConfig);
}

// Obter referências aos serviços
window.database = firebase.database();
window.storage = firebase.storage();
window.auth = firebase.auth();

console.log("Firebase inicializado com sucesso");
