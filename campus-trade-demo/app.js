const state = {
  view: 'home',
  authTab: 'login',
  user: null,
  favorites: new Set(),
  selectedChat: 0,
  selectedItem: null,
  search: {
    keyword: '',
    category: '全部',
    campus: '全部',
    price: '全部',
    condition: '全部',
    sort: '最新'
  }
};

const data = {
  categories: ['全部', '数码', '教材', '生活用品', '交通工具', '租房'],
  campuses: ['全部', '北校区', '南校区', '东校区'],
  items: [
    { id: 1, title: '九成新无线键盘', category: '数码', campus: '北校区', price: 68, condition: 9.0, time: '1小时前', seller: '张同学', verified: true, desc: '蓝牙连接，续航优秀，含接收器。', tags: ['包邮'] },
    { id: 2, title: '二手 iPad 10 64G', category: '数码', campus: '南校区', price: 1450, condition: 8.5, time: '2天前', seller: '李同学', verified: true, desc: '无磕碰，电池健康 92%。', tags: ['面交'] },
    { id: 3, title: '考研数学教材全套', category: '教材', campus: '北校区', price: 120, condition: 9.5, time: '5小时前', seller: '王同学', verified: false, desc: '近乎全新，含笔记。', tags: ['可小刀'] },
    { id: 4, title: '折叠自行车', category: '交通工具', campus: '东校区', price: 480, condition: 7.5, time: '3天前', seller: '赵同学', verified: true, desc: '轻便好骑，适合校园通勤。', tags: ['支持面交'] },
    { id: 5, title: '宿舍小风扇', category: '生活用品', campus: '北校区', price: 35, condition: 9.0, time: '2小时前', seller: '孙同学', verified: true, desc: '静音款，三档风速。', tags: ['包邮'] },
    { id: 6, title: '南校区单间转租', category: '租房', campus: '南校区', price: 1800, condition: 10, time: '1天前', seller: '钱同学', verified: false, desc: '采光好，可月付。', tags: ['可短租'] }
  ],
  orders: [
    { id: 'B2025018', item: '二手 iPad 10', price: 1450, status: '待确认', role: 'buyer' },
    { id: 'B2025021', item: '无线键盘', price: 68, status: '进行中', role: 'buyer' },
    { id: 'B2025024', item: '考研教材', price: 120, status: '已完成', role: 'buyer' }
  ],
  sellerOrders: [
    { id: 'S2025008', buyer: '李同学', item: '二手耳机', price: 220, status: '待确认' },
    { id: 'S2025011', buyer: '王同学', item: '折叠桌', price: 90, status: '待确认' }
  ],
  chats: [
    { name: '张同学', messages: [
      { from: 'other', text: '你好，可以当面验货吗？' },
      { from: 'me', text: '可以的，图书馆门口见。' }
    ]},
    { name: '李同学', messages: [
      { from: 'other', text: '还能再便宜一点吗？' },
      { from: 'me', text: '可以小刀，给你 1400。' }
    ]}
  ],
  adminListings: [
    { id: 'A01', title: '二手显卡 RTX 3060', user: '王同学', time: '10分钟前', status: '待审核' },
    { id: 'A02', title: '毕业闲置桌椅', user: '李同学', time: '1小时前', status: '待审核' }
  ],
  users: [
    { id: 'U01', name: '张同学', status: '正常', reg: '2024-09-01' },
    { id: 'U02', name: '李同学', status: '正常', reg: '2024-10-12' },
    { id: 'U03', name: '王同学', status: '禁用', reg: '2024-11-20' }
  ]
};

const navItems = [
  { id: 'home', label: '首页' },
  { id: 'search', label: '搜索筛选' },
  { id: 'publish', label: '发布' },
  { id: 'messages', label: '消息' },
  { id: 'orders', label: '订单' },
  { id: 'seller', label: '卖家后台' },
  { id: 'admin', label: '管理员后台' }
];

const nav = document.getElementById('nav');
const viewBox = document.getElementById('view');
const authPanel = document.getElementById('authPanel');
const tipsPanel = document.getElementById('tipsPanel');
const breadcrumbs = document.getElementById('breadcrumbs');
const userBox = document.getElementById('userBox');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function init() {
  renderNav();
  renderAuth();
  renderTips();
  renderView();
  renderUser();
  modalClose.addEventListener('click', () => modal.classList.remove('show'));
}

function renderNav() {
  nav.innerHTML = '';
  navItems.forEach(item => {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.className = item.id === state.view ? 'active' : '';
    btn.onclick = () => {
      state.view = item.id;
      renderNav();
      renderView();
    };
    nav.appendChild(btn);
  });
}

function renderUser() {
  if (!state.user) {
    userBox.innerHTML = '<span class="badge">未登录</span>';
    return;
  }
  userBox.innerHTML = `
    <span class="badge">${state.user.name} · ${state.user.role}</span>
  `;
}

function renderAuth() {
  if (state.user) {
    authPanel.innerHTML = `
      <h3>已登录</h3>
      <div class="field">账号：${state.user.name}</div>
      <div class="field">角色：${state.user.role}</div>
      <div class="field"><button class="btn ghost" id="switchSeller">切换为卖家</button></div>
      <div class="field"><button class="btn ghost" id="switchAdmin">切换为管理员</button></div>
      <div class="field"><button class="btn danger" id="logout">退出登录</button></div>
    `;
    document.getElementById('logout').onclick = () => {
      state.user = null;
      renderAuth();
      renderUser();
    };
    document.getElementById('switchSeller').onclick = () => {
      state.user.role = '卖家';
      renderUser();
      renderView();
    };
    document.getElementById('switchAdmin').onclick = () => {
      state.user.role = '管理员';
      renderUser();
      renderView();
    };
    return;
  }

  authPanel.innerHTML = `
    <h3>账号入口</h3>
    <div class="tabs">
      <button class="${state.authTab === 'login' ? 'active' : ''}" data-tab="login">登录</button>
      <button class="${state.authTab === 'register' ? 'active' : ''}" data-tab="register">注册</button>
    </div>
    <div class="field">
      <label>学号</label>
      <input placeholder="例如：2022001234" id="account" />
    </div>
    <div class="field">
      <label>${state.authTab === 'login' ? '密码' : '设置密码'}</label>
      <input type="password" placeholder="••••••••" id="password" />
    </div>
    ${state.authTab === 'register' ? `
      <div class="field">
        <label>学院</label>
        <input placeholder="计算科学与人工智能学院" />
      </div>
      <div class="field">
        <label>手机号</label>
        <input placeholder="138xxxxxx" />
      </div>
    ` : ''}
    <div class="field"><button class="btn primary" id="authBtn">${state.authTab === 'login' ? '登录' : '注册并登录'}</button></div>
    <div class="field"><span class="badge info">测试账号：任意学号均可</span></div>
  `;
  authPanel.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = () => {
      state.authTab = btn.dataset.tab;
      renderAuth();
    };
  });
  document.getElementById('authBtn').onclick = () => {
    const name = document.getElementById('account').value || '体验用户';
    state.user = { name, role: '学生', verified: true };
    renderAuth();
    renderUser();
  };
}

function renderTips() {
  tipsPanel.innerHTML = `
    <h3>演示提示</h3>
    <div class="list">
      <div class="card">1. 点击商品卡片可查看详情。</div>
      <div class="card">2. 发布商品后会同步到卖家列表。</div>
      <div class="card">3. 订单/消息支持交互更新。</div>
      <div class="card">4. 管理员后台可审核商品。</div>
    </div>
  `;
}

function renderView() {
  switch (state.view) {
    case 'home':
      breadcrumbs.textContent = '首页 / 推荐';
      renderHome();
      break;
    case 'search':
      breadcrumbs.textContent = '搜索 / 筛选';
      renderSearch();
      break;
    case 'publish':
      breadcrumbs.textContent = '发布 / 新商品';
      renderPublish();
      break;
    case 'messages':
      breadcrumbs.textContent = '消息 / 私聊';
      renderMessages();
      break;
    case 'orders':
      breadcrumbs.textContent = '订单 / 交易';
      renderOrders();
      break;
    case 'seller':
      breadcrumbs.textContent = '卖家后台 / 管理';
      renderSeller();
      break;
    case 'admin':
      breadcrumbs.textContent = '管理员后台 / 审核';
      renderAdmin();
      break;
    default:
      renderHome();
  }
}

function renderHome() {
  const cards = data.items.map(item => `
    <div class="card item">
      <div class="thumb"></div>
      <div class="meta">
        <div><strong>${item.title}</strong></div>
        <div class="muted">${item.campus} · ${item.time} · 成色 ${item.condition}</div>
        <div class="price">¥ ${item.price}</div>
        <div class="tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join(' ')}</div>
      </div>
      <div>
        <button class="btn ghost" onclick="openDetail(${item.id})">查看</button>
        <button class="btn ${state.favorites.has(item.id) ? 'primary' : 'ghost'}" onclick="toggleFav(${item.id})">${state.favorites.has(item.id) ? '已收藏' : '收藏'}</button>
      </div>
    </div>
  `).join('');

  viewBox.innerHTML = `
    <div class="card">
      <div class="tabs">${data.categories.map(c => `<button class="${state.search.category === c ? 'active' : ''}" onclick="setQuickCategory('${c}')">${c}</button>`).join('')}</div>
      <div class="grid cols-3" style="margin-top:14px;">${cards}</div>
    </div>
  `;
}

function renderSearch() {
  const filtered = filterItems();
  viewBox.innerHTML = `
    <div class="card">
      <div class="grid cols-2">
        <div>
          <div class="field">
            <label>关键字</label>
            <input id="kw" placeholder="例如：耳机" value="${state.search.keyword}" />
          </div>
          <div class="field">
            <label>分类</label>
            <select id="cat">${data.categories.map(c => `<option ${c === state.search.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>校区</label>
            <select id="campus">${data.campuses.map(c => `<option ${c === state.search.campus ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>价格区间</label>
            <select id="price">
              ${['全部', '0-100', '100-500', '500-2000', '2000+'].map(p => `<option ${p === state.search.price ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>成色</label>
            <select id="cond">
              ${['全部', '9-10', '8-9', '7-8', '7以下'].map(c => `<option ${c === state.search.condition ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>排序</label>
            <select id="sort">
              ${['最新', '价格升序', '价格降序'].map(s => `<option ${s === state.search.sort ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <button class="btn primary" id="apply">应用筛选</button>
            <button class="btn ghost" id="reset">重置</button>
          </div>
        </div>
        <div>
          <div class="list">
            ${filtered.map(item => `
              <div class="card item">
                <div class="thumb"></div>
                <div class="meta">
                  <div><strong>${item.title}</strong></div>
                  <div class="muted">${item.campus} · ${item.time} · 成色 ${item.condition}</div>
                </div>
                <div>
                  <div class="price">¥ ${item.price}</div>
                  <button class="btn ghost" onclick="openDetail(${item.id})">详情</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('apply').onclick = () => {
    state.search.keyword = document.getElementById('kw').value.trim();
    state.search.category = document.getElementById('cat').value;
    state.search.campus = document.getElementById('campus').value;
    state.search.price = document.getElementById('price').value;
    state.search.condition = document.getElementById('cond').value;
    state.search.sort = document.getElementById('sort').value;
    renderSearch();
  };
  document.getElementById('reset').onclick = () => {
    state.search = { keyword: '', category: '全部', campus: '全部', price: '全部', condition: '全部', sort: '最新' };
    renderSearch();
  };
}

function renderPublish() {
  viewBox.innerHTML = `
    <div class="card">
      <div class="grid cols-2">
        <div>
          <div class="field"><label>标题 *</label><input id="pTitle" placeholder="例如：九成新耳机" /></div>
          <div class="field"><label>分类 *</label><select id="pCat">${data.categories.filter(c => c !== '全部').map(c => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label>价格 *</label><input id="pPrice" placeholder="请输入价格" /></div>
          <div class="field"><label>成色 *</label><input id="pCond" placeholder="1-10" /></div>
          <div class="field"><label>校区 *</label><select id="pCampus">${data.campuses.filter(c => c !== '全部').map(c => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label>描述 *</label><textarea id="pDesc" placeholder="写清楚配件、瑕疵等"></textarea></div>
          <button class="btn primary" id="publishBtn">发布</button>
          <button class="btn ghost" id="draftBtn">保存草稿</button>
        </div>
        <div>
          <div class="card" style="background:#f1f4f9; min-height:240px;">
            <div style="font-weight:600; margin-bottom:8px;">上传图片（演示）</div>
            <div class="grid cols-3">
              ${new Array(6).fill(0).map(() => `<div class="card" style="height:80px;"></div>`).join('')}
            </div>
            <div class="muted" style="margin-top:8px; font-size:12px;">演示模式下图片自动使用占位图</div>
          </div>
          <div class="card" style="margin-top:12px;">
            <div style="font-weight:600; margin-bottom:6px;">发布提示</div>
            <div class="muted" style="font-size:12px;">发布后会进入审核流程，审核通过后上架。</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('publishBtn').onclick = () => {
    const title = document.getElementById('pTitle').value || '新发布商品';
    const item = {
      id: Date.now(),
      title,
      category: document.getElementById('pCat').value,
      campus: document.getElementById('pCampus').value,
      price: Number(document.getElementById('pPrice').value) || 99,
      condition: Number(document.getElementById('pCond').value) || 9,
      time: '刚刚',
      seller: state.user ? state.user.name : '体验用户',
      verified: !!state.user,
      desc: document.getElementById('pDesc').value || '暂无描述',
      tags: ['新发布']
    };
    data.items.unshift(item);
    data.adminListings.unshift({ id: `A${Math.floor(Math.random()*100)}`, title, user: item.seller, time: '刚刚', status: '待审核' });
    alert('发布成功（演示）：已进入审核队列');
    renderHome();
  };

  document.getElementById('draftBtn').onclick = () => alert('草稿已保存（演示）');
}

function renderMessages() {
  viewBox.innerHTML = `
    <div class="card chat">
      <div class="chat-list">
        ${data.chats.map((c, i) => `
          <div class="chat-item ${i === state.selectedChat ? 'active' : ''}" onclick="selectChat(${i})">
            <strong>${c.name}</strong><br />
            <span class="muted">${c.messages[c.messages.length - 1].text}</span>
          </div>
        `).join('')}
      </div>
      <div>
        <div class="chat-room">
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-input">
            <input id="chatInput" placeholder="输入消息…" />
            <button class="btn primary" onclick="sendMsg()">发送</button>
          </div>
        </div>
      </div>
    </div>
  `;
  renderChatMessages();
}

function renderOrders() {
  viewBox.innerHTML = `
    <div class="card">
      <div class="tabs">
        <button class="active">全部</button>
        <button>待确认</button>
        <button>进行中</button>
        <button>已完成</button>
      </div>
      <table class="table" style="margin-top:12px;">
        <thead>
          <tr><th>订单号</th><th>商品</th><th>金额</th><th>状态</th><th>操作</th></tr>
        </thead>
        <tbody>
          ${data.orders.map(o => `
            <tr>
              <td>${o.id}</td>
              <td>${o.item}</td>
              <td>¥ ${o.price}</td>
              <td><span class="badge ${o.status === '已完成' ? 'success' : o.status === '进行中' ? 'info' : 'warn'}">${o.status}</span></td>
              <td>
                ${o.status !== '已完成' ? `<button class="btn ghost" onclick="confirmOrder('${o.id}')">确认</button>` : ''}
                ${o.status === '待确认' ? `<button class="btn danger" onclick="cancelOrder('${o.id}')">取消</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSeller() {
  viewBox.innerHTML = `
    <div class="card">
      <div class="tabs">
        <button class="active">我的发布</button>
        <button onclick="renderPublish()">发布新商品</button>
        <button onclick="renderSellerOrders()">订单处理</button>
        <button onclick="renderSellerFinance()">财务统计</button>
      </div>
      <div class="list" style="margin-top:14px;">
        ${data.items.slice(0, 4).map(item => `
          <div class="card item">
            <div class="thumb"></div>
            <div class="meta">
              <div><strong>${item.title}</strong></div>
              <div class="muted">状态：已上架 · 浏览 ${Math.floor(Math.random()*200)}</div>
            </div>
            <div>
              <button class="btn ghost" onclick="editItem(${item.id})">编辑</button>
              <button class="btn danger" onclick="toggleItem(${item.id})">下架</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSellerOrders() {
  viewBox.innerHTML = `
    <div class="card">
      <h3>卖家订单处理</h3>
      <table class="table">
        <thead><tr><th>订单号</th><th>买家</th><th>商品</th><th>金额</th><th>操作</th></tr></thead>
        <tbody>
          ${data.sellerOrders.map(o => `
            <tr>
              <td>${o.id}</td>
              <td>${o.buyer}</td>
              <td>${o.item}</td>
              <td>¥ ${o.price}</td>
              <td>
                <button class="btn primary" onclick="sellerApprove('${o.id}')">同意</button>
                <button class="btn ghost" onclick="sellerReject('${o.id}')">拒绝</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSellerFinance() {
  viewBox.innerHTML = `
    <div class="card">
      <h3>财务统计</h3>
      <div class="stat-grid">
        <div class="stat"><div class="muted">本月成交额</div><div class="price">¥ 3,260</div></div>
        <div class="stat"><div class="muted">待结算</div><div class="price">¥ 480</div></div>
        <div class="stat"><div class="muted">信用评分</div><div class="price">4.9 / 5</div></div>
      </div>
      <div class="card" style="margin-top:12px; background:#f1f4f9; height:220px;">成交趋势（演示图）</div>
    </div>
  `;
}

function renderAdmin() {
  viewBox.innerHTML = `
    <div class="card">
      <div class="stat-grid">
        <div class="stat"><div class="muted">活跃用户</div><div class="price">1,280</div></div>
        <div class="stat"><div class="muted">新增商品</div><div class="price">268</div></div>
        <div class="stat"><div class="muted">成交订单</div><div class="price">92</div></div>
      </div>
    </div>
    <div class="card">
      <h3>商品审核队列</h3>
      <table class="table">
        <thead><tr><th>商品</th><th>发布人</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          ${data.adminListings.map(l => `
            <tr>
              <td>${l.title}</td>
              <td>${l.user}</td>
              <td>${l.time}</td>
              <td><span class="badge ${l.status === '通过' ? 'success' : l.status === '驳回' ? 'danger' : 'warn'}">${l.status}</span></td>
              <td>
                <button class="btn primary" onclick="adminApprove('${l.id}')">通过</button>
                <button class="btn ghost" onclick="adminReject('${l.id}')">驳回</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3>用户管理</h3>
      <table class="table">
        <thead><tr><th>用户</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>
          ${data.users.map(u => `
            <tr>
              <td>${u.name}</td>
              <td>${u.status}</td>
              <td>${u.reg}</td>
              <td><button class="btn ghost" onclick="toggleUser('${u.id}')">${u.status === '正常' ? '禁用' : '启用'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterItems() {
  let items = [...data.items];
  const { keyword, category, campus, price, condition, sort } = state.search;
  if (keyword) items = items.filter(i => i.title.includes(keyword));
  if (category !== '全部') items = items.filter(i => i.category === category);
  if (campus !== '全部') items = items.filter(i => i.campus === campus);
  if (price !== '全部') {
    items = items.filter(i => {
      if (price === '0-100') return i.price <= 100;
      if (price === '100-500') return i.price > 100 && i.price <= 500;
      if (price === '500-2000') return i.price > 500 && i.price <= 2000;
      if (price === '2000+') return i.price > 2000;
      return true;
    });
  }
  if (condition !== '全部') {
    items = items.filter(i => {
      if (condition === '9-10') return i.condition >= 9;
      if (condition === '8-9') return i.condition >= 8 && i.condition < 9;
      if (condition === '7-8') return i.condition >= 7 && i.condition < 8;
      if (condition === '7以下') return i.condition < 7;
      return true;
    });
  }
  if (sort === '价格升序') items.sort((a, b) => a.price - b.price);
  if (sort === '价格降序') items.sort((a, b) => b.price - a.price);
  return items;
}

function setQuickCategory(cat) {
  state.search.category = cat;
  renderHome();
}

function toggleFav(id) {
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  renderHome();
}

function openDetail(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  state.selectedItem = item;
  modalBody.innerHTML = `
    <div class="grid cols-2">
      <div>
        <div class="card" style="height:280px; background:#f1f4f9;"></div>
        <div class="grid cols-3" style="margin-top:12px;">
          ${new Array(3).fill(0).map(() => `<div class="card" style="height:70px;"></div>`).join('')}
        </div>
      </div>
      <div>
        <h3>${item.title}</h3>
        <div class="price">¥ ${item.price}</div>
        <div class="muted">成色 ${item.condition} · ${item.campus} · ${item.time}</div>
        <div style="margin-top:10px;">卖家：${item.seller} ${item.verified ? '<span class="badge info">学号认证</span>' : ''}</div>
        <p style="margin-top:10px;">${item.desc}</p>
        <div class="card" style="background:#fff7e6;">
          <strong>安全提示</strong>
          <div class="muted">建议校内面交，验货后再付款。</div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn primary" onclick="startChat('${item.seller}')">立即私聊</button>
          <button class="btn ghost" onclick="toggleFav(${item.id})">${state.favorites.has(item.id) ? '已收藏' : '收藏'}</button>
        </div>
      </div>
    </div>
  `;
  modal.classList.add('show');
}

function startChat(name) {
  state.view = 'messages';
  renderNav();
  renderMessages();
  modal.classList.remove('show');
}

function selectChat(index) {
  state.selectedChat = index;
  renderMessages();
}

function renderChatMessages() {
  const chat = data.chats[state.selectedChat];
  const box = document.getElementById('chatMessages');
  if (!box || !chat) return;
  box.innerHTML = chat.messages.map(m => `<div class="bubble ${m.from}">${m.text}</div>`).join('');
}

function sendMsg() {
  const input = document.getElementById('chatInput');
  if (!input || !input.value.trim()) return;
  data.chats[state.selectedChat].messages.push({ from: 'me', text: input.value.trim() });
  input.value = '';
  renderChatMessages();
}

function confirmOrder(id) {
  const order = data.orders.find(o => o.id === id);
  if (!order) return;
  order.status = '已完成';
  renderOrders();
}

function cancelOrder(id) {
  const order = data.orders.find(o => o.id === id);
  if (!order) return;
  order.status = '已取消';
  renderOrders();
}

function editItem(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  alert(`进入编辑（演示）：${item.title}`);
}

function toggleItem(id) {
  alert('商品已下架（演示）');
}

function sellerApprove(id) {
  const order = data.sellerOrders.find(o => o.id === id);
  if (!order) return;
  order.status = '已确认';
  alert('已同意订单');
  renderSellerOrders();
}

function sellerReject(id) {
  const order = data.sellerOrders.find(o => o.id === id);
  if (!order) return;
  order.status = '已拒绝';
  alert('已拒绝订单');
  renderSellerOrders();
}

function adminApprove(id) {
  const item = data.adminListings.find(l => l.id === id);
  if (!item) return;
  item.status = '通过';
  renderAdmin();
}

function adminReject(id) {
  const item = data.adminListings.find(l => l.id === id);
  if (!item) return;
  item.status = '驳回';
  renderAdmin();
}

function toggleUser(id) {
  const user = data.users.find(u => u.id === id);
  if (!user) return;
  user.status = user.status === '正常' ? '禁用' : '正常';
  renderAdmin();
}

window.openDetail = openDetail;
window.toggleFav = toggleFav;
window.setQuickCategory = setQuickCategory;
window.selectChat = selectChat;
window.sendMsg = sendMsg;
window.confirmOrder = confirmOrder;
window.cancelOrder = cancelOrder;
window.renderSellerOrders = renderSellerOrders;
window.renderSellerFinance = renderSellerFinance;
window.editItem = editItem;
window.toggleItem = toggleItem;
window.sellerApprove = sellerApprove;
window.sellerReject = sellerReject;
window.adminApprove = adminApprove;
window.adminReject = adminReject;
window.toggleUser = toggleUser;
window.startChat = startChat;

init();
