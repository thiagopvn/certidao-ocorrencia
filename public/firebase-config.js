// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyD3tQJ5evRr8Skp9iMCLSXKIewJJWPmrII",
  authDomain: "certidao-gocg.firebaseapp.com",
  databaseURL: "https://certidao-gocg-default-rtdb.firebaseio.com",
  projectId: "certidao-gocg",
  storageBucket: "certidao-gocg.appspot.com", // Corrigido o domínio do storage bucket
  messagingSenderId: "684546571684",
  appId: "1:684546571684:web:c104197a7c6b1c9f7a5531",
  measurementId: "G-YZHFGW74Y7",
};

// Inicializar Firebase APENAS SE ainda não foi inicializado
if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado com sucesso pelo firebase-config.js!");
  } else {
    console.log("Firebase já inicializado anteriormente");
  }

  // Disponibilizar referências globais para compatibilidade
  window.database = firebase.database();
  window.storage = firebase.storage();
  window.auth = firebase.auth();

  // Verificar e configurar Firebase Functions se disponível
  if (firebase.functions) {
    window.functions = firebase.functions();
  }
} else {
  console.error(
    "ERRO CRÍTICO: Firebase SDK não está disponível! Verifique se os scripts do Firebase foram carregados antes deste arquivo."
  );
}
