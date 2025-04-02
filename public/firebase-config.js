window.firebaseConfig = {
  apiKey: "AIzaSyAefl_QBCkRg6edvVmkKc5iz0LxqpKJDIA",
  authDomain: "certidao-ocorrencia-adca7.firebaseapp.com",
  projectId: "certidao-ocorrencia-adca7",
  storageBucket: "certidao-ocorrencia-adca7.firebasestorage.app",
  messagingSenderId: "483191339614",
  appId: "1:483191339614:web:6158307f6305f5c71852cf",
  measurementId: "G-8HEWJE54FR",
  databaseURL: "https://certidao-ocorrencia-adca7-default-rtdb.firebaseio.com",
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
