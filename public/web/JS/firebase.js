import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBpG1GGm0BFPpwA9d9T01l6SS68ENi3q2k',
  authDomain: 'expressburg.firebaseapp.com',
  projectId: 'expressburg',
  storageBucket: 'expressburg.firebasestorage.app',
  messagingSenderId: '589862431764',
  appId: '1:589862431764:web:63a28ebe6ffeb9a06dcb01'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, 'sabor-express');
