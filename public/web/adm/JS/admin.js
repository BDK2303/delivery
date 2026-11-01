import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {
  getDoc,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { auth, db } from '../../JS/firebase.js';

let products = [];

function $(id) {
  return document.getElementById(id);
}

function renderProducts() {
  const snacks = $('lanche-box');
  const drinks = $('bebida-box');
  snacks.replaceChildren();
  drinks.replaceChildren();

  const renderCard = (product) => {
    const card = document.createElement('article');
    card.className = 'card';
    if (!product.active) card.style.opacity = '.6';

    const image = document.createElement('img');
    image.src = product.image || '';
    image.alt = product.name;
    image.className = product.category === 'bebidas' ? 'bebidaimg' : 'lancheimg';
    const name = document.createElement('h3');
    name.className = product.category === 'bebidas' ? 'bebidaname' : 'lanchename';
    name.textContent = product.name;
    const description = document.createElement('p');
    description.className = 'componentes';
    description.textContent = product.description || '';
    const price = document.createElement('p');
    price.className = 'valor';
    price.textContent = `R$ ${Number(product.price).toFixed(2).replace('.', ',')}${product.active ? '' : ' · Inativo'}`;

    const actions = document.createElement('div');
    actions.className = 'card-adm-actions';
    const edit = document.createElement('button');
    edit.className = 'btn-adm-edit';
    edit.type = 'button';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => abrirModalProduto(product.id));
    const remove = document.createElement('button');
    remove.className = 'btn-adm-del';
    remove.type = 'button';
    remove.textContent = 'Excluir';
    remove.addEventListener('click', () => excluirProduto(product.id));
    actions.append(edit, remove);
    card.append(image, name, description, price, actions);
    return card;
  };

  const snacksList = products.filter((product) => product.category !== 'bebidas');
  const drinksList = products.filter((product) => product.category === 'bebidas');
  if (!snacksList.length) snacks.textContent = 'Nenhum lanche cadastrado.';
  if (!drinksList.length) drinks.textContent = 'Nenhuma bebida cadastrada.';
  snacksList.forEach((product) => snacks.append(renderCard(product)));
  drinksList.forEach((product) => drinks.append(renderCard(product)));

  const highlight = products.find((product) => product.highlighted && product.active)
    || products.find((product) => product.category !== 'bebidas' && product.active);
  if (highlight) {
    $('img-alta').src = highlight.image || '';
    $('nome-alta').textContent = `Lanche em alta: ${highlight.name}`;
    $('desc-alta').textContent = highlight.description || '';
  }
}

function startProductsListener() {
  return onSnapshot(collection(db, 'products'), (snapshot) => {
    products = snapshot.docs.map((product) => ({ id: product.id, ...product.data() }));
    renderProducts();
  }, (error) => {
    console.error('Erro ao carregar produtos do Firestore:', error);
    $('lanche-box').textContent = `Erro ao carregar produtos: ${error.message}`;
  });
}

function abrirModalProduto(id) {
  const product = id == null ? null : products.find((item) => item.id === id);
  $('edit-id').value = product?.id || '';
  $('modal-titulo').textContent = product ? 'Editar Produto' : 'Novo Produto';
  $('m-nome').value = product?.name || '';
  $('m-categoria').value = product?.highlighted ? 'alta' : product?.category || 'lanches';
  $('m-componentes').value = product?.description || '';
  $('m-valor').value = product?.price ?? '';
  $('m-imagem').value = product?.image || '';
  $('m-destaque').checked = Boolean(product?.highlighted);
  $('m-ativo').checked = product ? product.active : true;
  $('modal-produto').classList.add('show');
}

function fecharModalProduto() {
  $('modal-produto').classList.remove('show');
}

async function salvarProduto() {
  const id = $('edit-id').value;
  const categorySelection = $('m-categoria').value;
  const name = $('m-nome').value.trim();
  const priceText = $('m-valor').value.trim();
  const price = Number(priceText);
  const image = $('m-imagem').value.trim();
  if (!name || name.length > 100 || !priceText || !Number.isFinite(price) || price < 0 || price > 10000) {
    alert('Informe um nome (até 100 caracteres) e preço válido (até R$ 10.000).');
    return;
  }
  if (image && !image.startsWith('https://')) {
    alert('A URL da imagem deve começar com https://.');
    return;
  }

  const now = serverTimestamp();
  const payload = {
    name,
    category: categorySelection === 'alta' ? 'lanches' : categorySelection,
    description: $('m-componentes').value.trim(),
    price,
    image,
    highlighted: categorySelection === 'alta' || $('m-destaque').checked,
    active: $('m-ativo').checked,
    updatedAt: now
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'products', id), payload);
    } else {
      await addDoc(collection(db, 'products'), { ...payload, createdAt: now });
    }
    fecharModalProduto();
  } catch (error) {
    console.error('Erro ao salvar produto:', error);
    alert(`Não foi possível salvar o produto: ${error.message}`);
  }
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    alert(`Não foi possível excluir o produto: ${error.message}`);
  }
}

async function logout() {
  try {
    await signOut(auth);
    window.location.href = '/login';
  } catch (error) {
    console.error('Não foi possível sair:', error);
    alert(`Não foi possível sair: ${error.message}`);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login';
    return;
  }
  try {
    const admin = await getDoc(doc(db, 'admins', user.uid));
    if (!admin.exists()) {
      alert('Acesso administrativo não autorizado.');
      await signOut(auth);
      window.location.href = '/login';
      return;
    }
    $('adm-nome').textContent = user.displayName || user.email;
    startProductsListener();
  } catch (error) {
    console.error('Não foi possível validar acesso administrativo:', error);
    alert(`Erro ao validar acesso administrativo: ${error.message}`);
    window.location.href = '/login';
  }
});

$('modal-produto').addEventListener('click', (event) => {
  if (event.target === $('modal-produto')) fecharModalProduto();
});

window.abrirModalProduto = abrirModalProduto;
window.fecharModalProduto = fecharModalProduto;
window.salvarProduto = salvarProduto;
window.excluirProduto = excluirProduto;
window.logout = logout;
