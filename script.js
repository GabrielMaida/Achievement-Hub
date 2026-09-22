const STEAM_CDN_BASE = 'https://cdn.akamai.steamstatic.com/steam/apps';
const TSA_BASE_URL = 'https://truesteamachievements.com/game';

const gameForm = document.getElementById('game-form');
const gameGrid = document.getElementById('game-grid');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const editIndexInput = document.getElementById('edit-index');
const settingsModal = document.getElementById('settings-modal');

let games = [];
let ghSettings = JSON.parse(localStorage.getItem('ghSettings')) || null;

async function loadGames() {
	try {
		// Se a API estiver configurada, força o recarregamento direto do GitHub para evitar cache
		if (ghSettings && ghSettings.owner && ghSettings.repo && ghSettings.token) {
			const url = `https://api.github.com/repos/${ghSettings.owner}/${ghSettings.repo}/contents/games.json`;
			const res = await fetch(url, {
				headers: { 'Authorization': `Bearer ${ghSettings.token}` }
			});
			
			if (res.ok) {
				const data = await res.json();
				const decoded = decodeURIComponent(escape(atob(data.content)));
				games = JSON.parse(decoded);
			} else if (res.status === 404) {
				games = []; // O arquivo games.json ainda não existe no repositório
			} else {
				throw new Error('Falha ao autenticar na API do GitHub.');
			}
		} else {
			// Fallback para visitantes ou se não estiver configurado
			const res = await fetch('./games.json');
			if (res.ok) games = await res.json();
		}
		renderGames();
	} catch (error) {
		console.error('Erro ao carregar dados:', error);
		gameGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Erro ao carregar o catálogo. Configure a API do GitHub.</p>`;
	}
}

function renderGames() {
	gameGrid.innerHTML = '';

	games.forEach((game, index) => {
		const imageUrl = `${STEAM_CDN_BASE}/${game.appId}/library_600x900_2x.jpg`;
		const achievementUrl = `${TSA_BASE_URL}/${game.slug}/achievements`;

		const cardContainer = document.createElement('div');
		cardContainer.className = 'relative rounded-md overflow-hidden group aspect-[2/3] bg-[#1f1f1f] transition duration-300 hover:scale-105 hover:shadow-xl hover:shadow-black/50 hover:z-10 block';

		const cardLink = document.createElement('a');
		cardLink.href = achievementUrl;
		cardLink.target = '_blank';
		cardLink.title = game.name;
		cardLink.className = 'block w-full h-full';

		const img = document.createElement('img');
		img.src = imageUrl;
		img.alt = `Capa do jogo ${game.name}`;
		img.className = 'w-full h-full object-cover block';
		
		img.onerror = function() {
			this.src = 'https://via.placeholder.com/600x900/1f1f1f/e5e5e5.png?text=Sem+Capa';
		};

		const overlay = document.createElement('div');
		overlay.className = 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition duration-300 flex items-end h-1/2';
		
		const title = document.createElement('h3');
		title.textContent = game.name;
		title.className = 'text-white text-sm md:text-base font-medium drop-shadow-md';
		
		overlay.appendChild(title);
		cardLink.appendChild(img);
		cardLink.appendChild(overlay);

		const actionDiv = document.createElement('div');
		actionDiv.className = 'absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20';

		const editBtn = document.createElement('button');
		editBtn.className = 'bg-blue-600 hover:bg-blue-500 text-white p-2 rounded shadow-md transition';
		editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>`;
		editBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			startEdit(index);
		};

		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'bg-netflix-red hover:bg-netflix-darkred text-white p-2 rounded shadow-md transition';
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
		deleteBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			deleteGame(index);
		};

		actionDiv.appendChild(editBtn);
		actionDiv.appendChild(deleteBtn);
		cardContainer.appendChild(cardLink);
		cardContainer.appendChild(actionDiv);
		gameGrid.appendChild(cardContainer);
	});
}

async function handleAddOrUpdate(event) {
	event.preventDefault();

	const nameInput = document.getElementById('game-name').value.trim();
	const slugInput = document.getElementById('game-slug').value.trim();
	const appIdInput = document.getElementById('game-appid').value.trim();
	const editIndex = parseInt(editIndexInput.value);

	if (nameInput && slugInput && appIdInput) {
		const gameData = { name: nameInput, slug: slugInput, appId: appIdInput };

		if (editIndex >= 0) {
			games[editIndex] = gameData;
			cancelEdit();
		} else {
			games.unshift(gameData);
			gameForm.reset();
		}

		renderGames();
		await saveToGitHub(games);
	}
}

function startEdit(index) {
	const game = games[index];
	document.getElementById('game-name').value = game.name;
	document.getElementById('game-slug').value = game.slug;
	document.getElementById('game-appid').value = game.appId;
	
	editIndexInput.value = index;
	submitBtn.textContent = 'Salvar Alterações';
	cancelBtn.classList.remove('hidden');
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
	gameForm.reset();
	editIndexInput.value = "-1";
	submitBtn.textContent = 'Adicionar';
	cancelBtn.classList.add('hidden');
}

async function deleteGame(index) {
	const confirmDelete = confirm(`Deseja remover "${games[index].name}"?`);
	if (confirmDelete) {
		games.splice(index, 1);
		if (parseInt(editIndexInput.value) === index) cancelEdit();
		
		renderGames();
		await saveToGitHub(games);
	}
}

async function saveToGitHub(newGamesList) {
	if (!ghSettings || !ghSettings.token) {
		alert('Para salvar permanentemente, configure a API do GitHub no ícone de engrenagem.');
		return;
	}

	const { owner, repo, token } = ghSettings;
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/games.json`;
	
	const originalBtnText = submitBtn.textContent;
	submitBtn.textContent = 'Gravando...';
	submitBtn.disabled = true;

	try {
		let sha = undefined;
		const getRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
		
		if (getRes.ok) {
			const data = await getRes.json();
			sha = data.sha;
		}

		const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(newGamesList, null, 2))));
		const bodyData = {
			message: 'feat: atualiza catalogo de jogos via Achievement Hub',
			content: contentBase64
		};
		if (sha) bodyData.sha = sha;

		const putRes = await fetch(url, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(bodyData)
		});

		if (!putRes.ok) throw new Error('Erro ao commitar no repositório.');
	} catch (error) {
		alert('Falha ao salvar no GitHub. Verifique se o Token e os nomes estão corretos.');
		console.error(error);
	} finally {
		submitBtn.textContent = originalBtnText;
		submitBtn.disabled = false;
	}
}

// Funções do Modal de Configuração
function openSettings() {
	if (ghSettings) {
		document.getElementById('gh-owner').value = ghSettings.owner || '';
		document.getElementById('gh-repo').value = ghSettings.repo || '';
		document.getElementById('gh-token').value = ghSettings.token || '';
	}
	settingsModal.classList.remove('hidden');
}

function closeSettings() {
	settingsModal.classList.add('hidden');
}

function saveSettings() {
	const owner = document.getElementById('gh-owner').value.trim();
	const repo = document.getElementById('gh-repo').value.trim();
	const token = document.getElementById('gh-token').value.trim();

	if (owner && repo && token) {
		ghSettings = { owner, repo, token };
		localStorage.setItem('ghSettings', JSON.stringify(ghSettings));
		closeSettings();
		loadGames(); // Recarrega os dados autenticados
	} else {
		alert('Preencha todos os campos da configuração.');
	}
}

gameForm.addEventListener('submit', handleAddOrUpdate);
document.addEventListener('DOMContentLoaded', loadGames);