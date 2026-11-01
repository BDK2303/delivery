import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { auth, db } from '../../JS/firebase.js';

let orders = [];
let currentFilter = 'todos';
let stopOrdersListener = null;

function appendText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderOrders() {
  const list = document.getElementById('lista-pedidos');
  const filtered = currentFilter === 'todos'
    ? orders
    : orders.filter((order) => order.status === currentFilter);

  document.getElementById('count-todos').textContent = String(orders.length);
  document.getElementById('count-pendente').textContent =
    String(orders.filter((order) => order.status === 'pendente').length);
  document.getElementById('count-confirmado').textContent =
    String(orders.filter((order) => order.status === 'confirmado').length);
  list.replaceChildren();

  if (!filtered.length) {
    appendText(list, 'p', 'loading', `Nenhum pedido ${currentFilter}.`);
    return;
  }

  filtered.forEach((order) => {
    const card = document.createElement('article');
    card.className = `card-pedido ${order.status}`;
    const top = document.createElement('div');
    top.className = 'pedido-top';
    appendText(top, 'span', 'pedido-id', `#${order.id} - ${order.customerName || 'Cliente'}`);
    appendText(top, 'span', `status ${order.status}`, order.status);
    card.append(top);

    const info = document.createElement('div');
    info.className = 'pedido-info';
    appendText(info, 'p', '', order.customerEmail || '');
    appendText(info, 'p', '', order.deliveryAddress || '');
    appendText(info, 'p', '', `Pagamento: ${order.paymentMethod || ''}`);
    appendText(info, 'p', 'valor-total', `Total: R$ ${order.total.toFixed(2).replace('.', ',')}`);
    const createdAt = order.createdAt?.toDate?.();
    appendText(info, 'p', '', createdAt ? createdAt.toLocaleString('pt-BR') : 'Data indisponível');
    card.append(info);

    const itemSection = document.createElement('div');
    itemSection.className = 'pedido-itens';
    appendText(itemSection, 'h5', '', 'Itens');
    const itemList = document.createElement('ul');
    order.items.forEach((item) => {
      appendText(itemList, 'li', '', `${item.quantity}x ${item.name} — R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}`);
    });
    itemSection.append(itemList);
    card.append(itemSection);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    if (order.status === 'pendente') {
      const confirm = document.createElement('button');
      confirm.className = 'btn-confirmar';
      confirm.type = 'button';
      confirm.textContent = 'Confirmar pedido (+50 min)';
      confirm.addEventListener('click', () => confirmarPedido(order.id));
      actions.append(confirm);
    } else {
      const confirmed = appendText(actions, 'button', 'btn-confirmar', 'Já confirmado');
      confirmed.disabled = true;
    }
    card.append(actions);
    list.append(card);
  });
}

async function loadOrders(snapshot) {
  try {
    const loaded = await Promise.all(snapshot.docs.map(async (orderSnapshot) => {
      const order = orderSnapshot.data();
      const [profileSnapshot, itemsSnapshot] = await Promise.all([
        getDoc(doc(db, 'users', order.userId)),
        getDocs(collection(db, 'orders', orderSnapshot.id, 'items'))
      ]);
      const profile = profileSnapshot.data() || {};
      const items = itemsSnapshot.docs.map((item) => item.data());
      const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
        + Number(order.deliveryFee || 0);
      return {
        id: orderSnapshot.id,
        ...order,
        customerName: profile.name || '',
        customerEmail: profile.email || '',
        items,
        total
      };
    }));
    orders = loaded.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    renderOrders();
  } catch (error) {
    console.error('Erro ao carregar pedidos do Firestore:', error);
    document.getElementById('lista-pedidos').textContent =
      `Erro ao carregar pedidos: ${error.message}`;
  }
}

function carregarPedidos() {
  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  stopOrdersListener?.();
  stopOrdersListener = onSnapshot(
    query(collection(db, 'orders'), where('createdAt', '>=', since)),
    loadOrders,
    (error) => {
      console.error('Erro ao acompanhar pedidos:', error);
      document.getElementById('lista-pedidos').textContent =
        `Erro ao buscar pedidos: ${error.message}`;
    }
  );
}

async function confirmarPedido(id) {
  if (!confirm(`Confirmar pedido #${id}?`)) return;
  try {
    await updateDoc(doc(db, 'orders', id), { status: 'confirmado' });
  } catch (error) {
    console.error('Erro ao confirmar pedido:', error);
    alert(`Não foi possível confirmar o pedido: ${error.message}`);
  }
}

function filtrar(status) {
  currentFilter = status;
  document.querySelectorAll('.filtro').forEach((button) => button.classList.remove('active'));
  document.querySelector(`[data-status="${status}"]`)?.classList.add('active');
  renderOrders();
}

async function logout() {
  try {
    await signOut(auth);
    window.location.href = '../user/login.html';
  } catch (error) {
    console.error('Não foi possível sair:', error);
    alert(`Não foi possível sair: ${error.message}`);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../user/login.html';
    return;
  }
  try {
    const { getDoc } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    const admin = await getDoc(doc(db, 'admins', user.uid));
    if (!admin.exists()) {
      alert('Acesso administrativo não autorizado.');
      await signOut(auth);
      window.location.href = '../user/login.html';
      return;
    }
    carregarPedidos();
  } catch (error) {
    console.error('Não foi possível validar acesso administrativo:', error);
    document.getElementById('lista-pedidos').textContent =
      `Erro ao validar acesso administrativo: ${error.message}`;
  }
});

document.querySelectorAll('.filtro').forEach((button) => {
  button.addEventListener('click', () => filtrar(button.dataset.status));
});
document.getElementById('btn-atualizar-pedidos').addEventListener('click', carregarPedidos);
document.getElementById('btn-logout').addEventListener('click', logout);
window.carregarPedidos = carregarPedidos;
window.logout = logout;
