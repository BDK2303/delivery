import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { db } from './firebase.js';

const cartKey = 'sabor_express_cart';

function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    console.error('Não foi possível ler o carrinho salvo:', error);
    localStorage.removeItem(cartKey);
    return [];
  }
}

function addToCart(product) {
  const cart = readCart();
  const existing = cart.find((item) => item.productId === product.id);
  if (existing) {
    existing.qtd = Math.min(Number(existing.qtd) + 1, 50);
  } else {
    cart.push({
      productId: product.id,
      nome: product.name,
      categoria: product.category,
      preco: product.price,
      qtd: 1,
      img: product.image,
      obs: ''
    });
  }
  localStorage.setItem(cartKey, JSON.stringify(cart));
  alert(`${product.name} adicionado ao carrinho.`);
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'card';

  const image = document.createElement('img');
  image.src = product.image || '';
  image.alt = product.name;
  image.className = product.category === 'bebidas' ? 'bebidaimg' : 'lancheimg';
  image.onerror = () => {
    image.src = 'https://via.placeholder.com/400';
  };

  const name = document.createElement('h3');
  name.className = product.category === 'bebidas' ? 'bebidaname' : 'lanchename';
  name.textContent = product.name;

  const description = document.createElement('p');
  description.className = 'componentes';
  description.textContent = product.description || '';

  const price = document.createElement('p');
  price.className = 'valor';
  price.textContent = `R$ ${Number(product.price).toFixed(2).replace('.', ',')}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `addbtn ${product.category === 'bebidas' ? 'btnbebida' : ''}`;
  button.textContent = 'Adicionar ao carrinho';
  button.addEventListener('click', () => addToCart(product));

  card.append(image, name, description, price, button);
  return card;
}

function renderProducts(products) {
  const snacks = document.getElementById('box-lanches');
  const drinks = document.getElementById('box-bebidas');
  snacks.replaceChildren();
  drinks.replaceChildren();

  const activeSnacks = products.filter((product) => product.category !== 'bebidas');
  const activeDrinks = products.filter((product) => product.category === 'bebidas');
  if (activeSnacks.length === 0) snacks.textContent = 'Nenhum lanche disponível no momento.';
  if (activeDrinks.length === 0) drinks.textContent = 'Nenhuma bebida disponível no momento.';

  activeSnacks.forEach((product) => snacks.append(createProductCard(product)));
  activeDrinks.forEach((product) => drinks.append(createProductCard(product)));

  const highlighted = products.find((product) => product.highlighted)
    || activeSnacks[0];
  if (highlighted) {
    const image = document.getElementById('img-alta');
    const name = document.getElementById('nome-alta');
    const description = document.getElementById('desc-alta');
    image.src = highlighted.image || '';
    image.alt = highlighted.name;
    name.textContent = `Lanche em alta: ${highlighted.name}`;
    description.textContent = highlighted.description || '';
    document.getElementById('btn-alta').onclick = () => addToCart(highlighted);
  }
}

const activeProducts = query(collection(db, 'products'), where('active', '==', true));
onSnapshot(activeProducts, (snapshot) => {
  renderProducts(snapshot.docs.map((product) => ({ id: product.id, ...product.data() })));
}, (error) => {
  console.error('Erro ao carregar produtos do Firestore:', error);
  document.getElementById('box-lanches').textContent =
    'Não foi possível carregar o cardápio. Tente novamente mais tarde.';
});
