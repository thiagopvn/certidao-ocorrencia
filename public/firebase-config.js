// firebase-config.js
window.firebaseConfig = {
  apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
  authDomain: "certidao-gocg.firebaseapp.com",
  databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com",
  projectId: "certidao-gocg",
  storageBucket: "certidao-gocg.firebasestorage.app",
  messagingSenderId: "684546571684",
  appId: "1:684546571684:web:c104197a7c6b1c9f7a5531",
  measurementId: "G-YZHFGW74Y7",
  functionsRegion: "us-central1",
};

// Inicializar Firebase APENAS SE ainda não foi inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(window.firebaseConfig);
}

// Obter referências aos serviços
window.database = firebase.database();
window.storage = firebase.storage();
window.auth = firebase.auth();

// Verificar se o módulo de functions está disponível e inicializá-lo
if (typeof firebase.functions === "function") {
  window.functions = firebase.functions();
  if (window.firebaseConfig.functionsRegion) {
    try {
      window.functions = firebase
        .functions()
        .region(window.firebaseConfig.functionsRegion);
    } catch (error) {
      console.error("Erro ao definir região das funções:", error);
    }
  }
}
