window.firebaseConfig = {
  apiKey: "AIzaSyBkR9Jc7RjShkqwrgzU4pWa6LI4BIKx49I",
  authDomain: "certidao-ocorrencia.firebaseapp.com",
  databaseURL: "https://certidao-ocorrencia-default-rtdb.firebaseio.com",
  projectId: "certidao-ocorrencia",
  storageBucket: "certidao-ocorrencia.firebasestorage.app",
  messagingSenderId: "848936045913",
  appId: "1:848936045913:web:80ce9066f237d7b92dd048",
  measurementId: "G-YVW493683H",
  // Definir a região para as Cloud Functions (opcional)
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

  // Definir região personalizada se especificada
  if (window.firebaseConfig.functionsRegion) {
    window.functions = firebase
      .functions()
      .useRegion(window.firebaseConfig.functionsRegion);
  }

  console.log("Firebase Functions inicializado com sucesso");
}

console.log("Firebase inicializado com sucesso");
