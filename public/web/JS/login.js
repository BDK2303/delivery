import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { auth, db } from './firebase.js';

function trocarTab(tab) {
  document.querySelectorAll('.tabs button').forEach((button) => button.classList.remove('active'));
  document.querySelectorAll('.form').forEach((form) => form.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`form-${tab}`).classList.add('active');
}

function messageFromError(error) {
  const messages = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
    'auth/operation-not-allowed': 'Ative o login por e-mail e senha no Firebase Authentication.'
  };
  return messages[error.code] || error.message;
}

document.getElementById('form-login').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-senha').value;
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const admin = await getDoc(doc(db, 'admins', credential.user.uid));
    window.location.href = admin.exists() ? '/adm' : '/carrinho';
  } catch (error) {
    alert(`Não foi possível entrar: ${messageFromError(error)}`);
  }
});

document.getElementById('form-cadastro').addEventListener('submit', async (event) => {
  event.preventDefault();
  const profile = {
    name: document.getElementById('cad-nome').value.trim(),
    email: document.getElementById('cad-email').value.trim(),
    phone: document.getElementById('cad-telefone').value.trim(),
    street: document.getElementById('cad-rua').value.trim(),
    number: document.getElementById('cad-numero').value.trim(),
    neighborhood: document.getElementById('cad-bairro').value.trim()
  };
  const password = document.getElementById('cad-senha').value;
  if (!profile.name || !profile.email || !password) {
    alert('Preencha nome, e-mail e senha.');
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, profile.email, password);
    await updateProfile(credential.user, { displayName: profile.name });
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      ...profile,
      email: credential.user.email,
      createdAt: serverTimestamp()
    });
    alert('Conta criada com sucesso.');
    trocarTab('login');
    document.getElementById('login-email').value = profile.email;
  } catch (error) {
    alert(`Não foi possível criar a conta: ${messageFromError(error)}`);
  }
});

document.getElementById('btn-redefinir-senha').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  if (!email) {
    alert('Informe seu e-mail no campo de login para receber o link de redefinição.');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert('Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.');
  } catch (error) {
    alert(`Não foi possível enviar o link: ${messageFromError(error)}`);
  }
});

window.trocarTab = trocarTab;
