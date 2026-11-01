import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { auth, db } from './firebase.js';

const TAXA = 5;
const CART_KEY = 'sabor_express_cart';
let currentUser = null;
let profile = null;
let stopOrdersListener = null;

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    console.error('Não foi possível ler o carrinho salvo:', error);
    localStorage.removeItem(CART_KEY);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const cart = getCart();
  const list = document.getElementById('lista-itens');
  document.getElementById('quantidade-itens').textContent =
    String(cart.reduce((total, item) => total + Number(item.qtd || 0), 0));

  if (!cart.length) {
    list.textContent = 'Seu carrinho está vazio. Volte ao cardápio para adicionar itens.';
  } else {
    list.replaceChildren();
    cart.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'item';
      const image = document.createElement('img');
      image.src = item.img || '';
      image.alt = item.nome;
      const info = document.createElement('div');
      info.className = 'item-info';
      const name = document.createElement('h3');
      name.textContent = item.nome;
      const price = document.createElement('p');
      price.className = 'preco';
      price.textContent = `R$ ${Number(item.preco).toFixed(2).replace('.', ',')}`;
      info.append(name, price);
      const quantity = document.createElement('div');
      quantity.className = 'qtd';
      const decrement = document.createElement('button');
      decrement.type = 'button';
      decrement.textContent = '-';
      decrement.addEventListener('click', () => changeQuantity(index, -1));
      const count = document.createElement('span');
      count.textContent = String(item.qtd);
      const increment = document.createElement('button');
      increment.type = 'button';
      increment.textContent = '+';
      increment.addEventListener('click', () => changeQuantity(index, 1));
      quantity.append(decrement, count, increment);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remover';
      remove.textContent = 'Remover';
      remove.addEventListener('click', () => removeItem(index));
      row.append(image, info, quantity, remove);
      list.append(row);
    });
  }

  const subtotal = cart.reduce((total, item) => total + Number(item.preco) * Number(item.qtd), 0);
  document.getElementById('subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  document.getElementById('taxa').textContent = `R$ ${TAXA.toFixed(2).replace('.', ',')}`;
  document.getElementById('total').textContent = `R$ ${(subtotal + TAXA).toFixed(2).replace('.', ',')}`;
}

function changeQuantity(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].qtd = Number(cart[index].qtd) + delta;
  if (cart[index].qtd <= 0) cart.splice(index, 1);
  if (cart[index] && cart[index].qtd > 50) cart[index].qtd = 50;
  saveCart(cart);
}

function removeItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

function showLatestOrder(snapshot) {
  const statusCard = document.getElementById('status-pedido');
  if (snapshot.empty) {
    statusCard.classList.remove('show');
    return;
  }
  const latest = snapshot.docs
    .map((order) => ({ id: order.id, ...order.data() }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))[0];
  const confirmed = latest.status === 'confirmado';
  const header = document.getElementById('status-header');
  header.className = `status-header ${confirmed ? 'confirmado' : 'pendente'}`;
  document.getElementById('status-titulo').textContent = confirmed ? 'Pedido confirmado' : 'Pedido enviado';
  document.getElementById('status-lista').textContent =
    `Pedido #${latest.id} · ${confirmed ? 'A cozinha já está preparando seu pedido.' : 'Aguardando confirmação do restaurante.'}`;
  document.getElementById('status-prazo').textContent =
    confirmed ? 'Prazo estimado: 50 minutos' : '';
  document.getElementById('status-prazo').className = `prazo ${confirmed ? 'confirmado' : ''}`;
  statusCard.classList.toggle('confirmado', confirmed);
  statusCard.classList.add('show');
}

async function loadProfile(user) {
  const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
  if (!profileSnapshot.exists()) {
    throw new Error('Perfil não encontrado. Entre em contato com o restaurante.');
  }
  profile = profileSnapshot.data();
  document.getElementById('edit-rua').value = profile.street || '';
  document.getElementById('edit-numero').value = profile.number || '';
  document.getElementById('edit-bairro').value = profile.neighborhood || '';
  document.querySelector('.endereco-edit small').textContent =
    'O endereço será salvo junto ao pedido.';

  stopOrdersListener?.();
  stopOrdersListener = onSnapshot(
    query(collection(db, 'orders'), where('userId', '==', user.uid)),
    showLatestOrder,
    (error) => {
      console.error('Erro ao acompanhar pedidos:', error);
      document.getElementById('msg').textContent = `Não foi possível atualizar o status: ${error.message}`;
    }
  );
}

async function placeOrder() {
  const cart = getCart();
  const message = document.getElementById('msg');
  if (!cart.length) {
    message.textContent = 'Adicione ao menos um produto antes de finalizar.';
    return;
  }
  if (cart.length > 10) {
    message.textContent = 'O limite é de 10 produtos diferentes por pedido.';
    return;
  }
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }
  const street = document.getElementById('edit-rua').value.trim();
  const number = document.getElementById('edit-numero').value.trim();
  const neighborhood = document.getElementById('edit-bairro').value.trim();
  if (!street || !number || !neighborhood) {
    message.textContent = 'Preencha rua, número e bairro para a entrega.';
    return;
  }

  const button = document.getElementById('btn-finalizar');
  button.disabled = true;
  message.textContent = '';
  try {
    const batch = writeBatch(db);
    const orderRef = doc(collection(db, 'orders'));
    batch.set(orderRef, {
      userId: currentUser.uid,
      deliveryAddress: `${street}, ${number} - ${neighborhood}`,
      paymentMethod: document.querySelector('.pag-opcoes button.active')?.dataset.pag || 'Pix',
      deliveryFee: TAXA,
      status: 'pendente',
      createdAt: serverTimestamp()
    });
    cart.forEach((item) => {
      if (!item.productId) throw new Error(`O produto "${item.nome}" precisa ser removido e adicionado novamente ao carrinho.`);
      const itemRef = doc(collection(db, 'orders', orderRef.id, 'items'));
      batch.set(itemRef, {
        productId: item.productId,
        name: item.nome,
        category: item.categoria,
        price: Number(item.preco),
        quantity: Number(item.qtd),
        observation: String(item.obs || '')
      });
    });
    await batch.commit();
    localStorage.removeItem(CART_KEY);
    renderCart();
    message.textContent = `Pedido #${orderRef.id} enviado com sucesso.`;
  } catch (error) {
    console.error('Erro ao finalizar pedido:', error);
    message.textContent = `Não foi possível finalizar o pedido: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login';
    return;
  }
  currentUser = user;
  try {
    await loadProfile(user);
  } catch (error) {
    console.error('Erro ao carregar o perfil:', error);
    document.getElementById('msg').textContent = error.message;
  }
});

document.querySelectorAll('.pag-opcoes button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.pag-opcoes button').forEach((option) => option.classList.remove('active'));
    button.classList.add('active');
  });
});
document.getElementById('btn-finalizar').addEventListener('click', placeOrder);
document.getElementById('btn-sair').addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = '/login';
  } catch (error) {
    console.error('Não foi possível sair:', error);
    document.getElementById('msg').textContent = `Não foi possível sair: ${error.message}`;
  }
});
renderCart();
