const API_BASE = 'https://equran.id/api/v2';

const state = {
  surahs: [],
  selectedSurah: null,
  currentMode: 'tebak-ayat',
  score: 0,
  currentQuestion: null,
  answered: false,
  audio: null,
  playingAudioUrl: '',
};

const refs = {
  navButtons: document.querySelectorAll('.nav-btn'),
  panels: document.querySelectorAll('.panel'),
  quranStatus: document.getElementById('quranStatus'),
  surahList: document.getElementById('surahList'),
  surahDetail: document.getElementById('surahDetail'),
  mentorStatus: document.getElementById('mentorStatus'),
  modeButtons: document.querySelectorAll('.mode-btn'),
  scoreValue: document.getElementById('scoreValue'),
  selectedSurahInfo: document.getElementById('selectedSurahInfo'),
  mentorQuestion: document.getElementById('mentorQuestion'),
  mentorChoices: document.getElementById('mentorChoices'),
  mentorFeedback: document.getElementById('mentorFeedback'),
  nextQuestionBtn: document.getElementById('nextQuestionBtn'),
  restartBtn: document.getElementById('restartBtn'),
};

function getFirstAudioUrl(audioMap) {
  if (!audioMap || typeof audioMap !== 'object') {
    return '';
  }

  const values = Object.values(audioMap);
  const firstValid = values.find((value) => typeof value === 'string' && value.trim());
  return firstValid || '';
}

function attachAudioButtonEvents() {
  const audioButton = document.querySelector('.audio-btn');
  if (!audioButton) {
    return;
  }

  audioButton.addEventListener('click', () => {
    const url = audioButton.dataset.audioUrl;
    if (!url) {
      return;
    }

    toggleSurahAudio(url, audioButton);
  });
}

function toggleSurahAudio(url, button) {
  if (!url) {
    setStatus(refs.quranStatus, 'Audio surat tidak tersedia untuk surat ini.', 'error');
    return;
  }

  const isSameAudio = state.audio && state.playingAudioUrl === url && !state.audio.paused;

  if (isSameAudio) {
    state.audio.pause();
    state.audio.currentTime = 0;
    state.playingAudioUrl = '';
    if (button) {
      button.textContent = '▶ Putar Surat';
      button.classList.remove('is-playing');
    }
    return;
  }

  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
  }

  state.audio = new Audio(url);
  state.playingAudioUrl = url;
  state.audio.play().catch(() => {
    setStatus(refs.quranStatus, 'Browser memblokir pemutaran audio. Klik tombol lagi.', 'error');
  });

  const allButtons = document.querySelectorAll('.audio-btn');
  allButtons.forEach((item) => {
    item.textContent = item === button ? '■ Stop' : '▶ Putar Surat';
    item.classList.toggle('is-playing', item === button);
  });

  state.audio.onended = () => {
    state.playingAudioUrl = '';
    allButtons.forEach((item) => {
      item.textContent = '▶ Putar Surat';
      item.classList.remove('is-playing');
    });
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request gagal (${response.status})`);
  }

  return response.json();
}

function setStatus(element, message, type = 'info') {
  element.textContent = message;
  element.className = `status ${type}`;
}

function setFeedback(message, type = 'success') {
  refs.mentorFeedback.textContent = message;
  refs.mentorFeedback.className = `feedback ${type}`;
}

function updateScore() {
  refs.scoreValue.textContent = String(state.score);
}

function showSection(targetId) {
  refs.panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === targetId);
  });

  refs.navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.section === targetId);
  });
}

function shuffle(items) {
  const newItems = [...items];
  for (let i = newItems.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [newItems[i], newItems[randomIndex]] = [newItems[randomIndex], newItems[i]];
  }
  return newItems;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickDistinctIndices(totalCount, correctIndex, needCount) {
  const picked = new Set([correctIndex]);

  while (picked.size < needCount) {
    const candidate = randomInt(0, totalCount - 1);
    picked.add(candidate);
  }

  return [...picked];
}

async function loadSuratList() {
  try {
    setStatus(refs.quranStatus, 'Memuat daftar surat...', 'info');

    const response = await fetchJson(`${API_BASE}/surat`);
    const surahs = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];

    if (!surahs.length) {
      throw new Error('Data surat tidak tersedia.');
    }

    state.surahs = surahs;
    renderSurahList();

    const firstSurah = surahs[0];
    if (firstSurah && firstSurah.nomor) {
      await selectSurat(firstSurah.nomor);
    }

    setStatus(refs.quranStatus, 'Daftar surat siap.', 'success');
  } catch (error) {
    console.error(error);
    setStatus(refs.quranStatus, 'Gagal memuat daftar surat. Periksa koneksi internet atau server API.', 'error');
  }
}

function renderSurahList() {
  refs.surahList.innerHTML = state.surahs
    .map((surah) => {
      const isSelected = state.selectedSurah && Number(state.selectedSurah.nomor) === Number(surah.nomor);
      return `
        <button class="surah-btn ${isSelected ? 'selected' : ''}" type="button" data-nomor="${surah.nomor}">
          <strong>${surah.nomor}. ${surah.namaLatin || surah.nama}</strong>
          <small>${surah.arti || 'Surat'} • ${surah.jumlahAyat || 0} ayat</small>
        </button>
      `;
    })
    .join('');

  refs.surahList.querySelectorAll('.surah-btn').forEach((button) => {
    button.addEventListener('click', () => selectSurat(Number(button.dataset.nomor)));
  });
}

async function selectSurat(nomor) {
  try {
    setStatus(refs.quranStatus, 'Memuat surat yang dipilih...', 'info');

    const response = await fetchJson(`${API_BASE}/surat/${nomor}`);
    const detail = response?.data ?? response;

    if (!detail || !Array.isArray(detail.ayat)) {
      throw new Error('Struktur data surat tidak valid.');
    }

    state.selectedSurah = detail;
    renderSurahList();
    renderSurahDetail(detail);
    updateSelectedSurahInfo();
    generateQuestion();
    setStatus(refs.quranStatus, `Surat ${detail.namaLatin || detail.nama} berhasil dimuat.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(refs.quranStatus, 'Gagal memuat isi surat. Periksa jaringan atau API.', 'error');
  }
}

function renderSurahDetail(detail) {
  const audioUrl = getFirstAudioUrl(detail.audioFull);
  const ayatList = detail.ayat
    .map(
      (ayat) => `
        <article class="ayah-card">
          <p class="ayah-number">Ayat ${ayat.nomorAyat}</p>
          <p class="ayah-arabic">${ayat.teksArab || 'Teks Arab tidak tersedia'}</p>
          <p class="ayah-translation">${ayat.teksIndonesia ? `Terjemahan: ${ayat.teksIndonesia}` : 'Terjemahan tidak tersedia.'}</p>
        </article>
      `
    )
    .join('');

  refs.surahDetail.innerHTML = `
    <div class="surah-header-row">
      <div>
        <h2>${detail.nama || 'Surat'}</h2>
        <div class="surah-meta">
          <span>Nomor: ${detail.nomor || '-'}</span>
          <span>${detail.namaLatin || '-'}</span>
          <span>${detail.jumlahAyat || 0} ayat</span>
          <span>${detail.tempatTurun || 'Tempat turun tidak tersedia'}</span>
        </div>
      </div>
      ${audioUrl ? `<button class="audio-btn" type="button" data-audio-url="${audioUrl}">▶ Putar Surat</button>` : ''}
    </div>
    <div class="ayat-list">${ayatList}</div>
  `;

  attachAudioButtonEvents();
}

function updateSelectedSurahInfo() {
  if (!state.selectedSurah) {
    refs.selectedSurahInfo.textContent = 'Pilih surat di menu Al-Qur\'an untuk mulai murajaah.';
    return;
  }

  refs.selectedSurahInfo.textContent = `Surat aktif: ${state.selectedSurah.namaLatin || state.selectedSurah.nama} (${state.selectedSurah.ayat.length} ayat)`;
}

function setMentorMessage(message, type = 'info') {
  refs.mentorStatus.textContent = message;
  refs.mentorStatus.className = `status ${type}`;
}

function createTebakAyatQuestion() {
  if (!state.selectedSurah || !state.selectedSurah.ayat || state.selectedSurah.ayat.length < 4) {
    return {
      message: 'Jumlah ayat kurang dari empat untuk membuat tiga opsi yang berbeda. Pilih surat lain.',
      type: 'warning',
    };
  }

  const ayatList = state.selectedSurah.ayat;
  const correctIndex = randomInt(0, ayatList.length - 1);
  const correctNumber = ayatList[correctIndex].nomorAyat;

  const wrongIndices = [];
  const unique = new Set([correctIndex]);

  while (wrongIndices.length < 2) {
    const candidate = randomInt(0, ayatList.length - 1);
    if (!unique.has(candidate)) {
      unique.add(candidate);
      wrongIndices.push(candidate);
    }
  }

  const answerPool = [
    { id: 'opt-1', value: correctNumber },
    { id: 'opt-2', value: ayatList[wrongIndices[0]].nomorAyat },
    { id: 'opt-3', value: ayatList[wrongIndices[1]].nomorAyat },
  ];

  const options = shuffle(answerPool);
  const correctOptionId = options.find((option) => option.value === correctNumber)?.id || options[0].id;

  return {
    type: 'tebak-ayat',
    prompt: ayatList[correctIndex].teksArab,
    options,
    correctOptionId,
    correctValue: correctNumber,
  };
}

function createSambungAyatQuestion() {
  if (!state.selectedSurah || !state.selectedSurah.ayat || state.selectedSurah.ayat.length < 4) {
    return {
      message: 'Jumlah ayat kurang dari empat untuk membuat tiga opsi yang berbeda. Pilih surat lain.',
      type: 'warning',
    };
  }

  const ayatList = state.selectedSurah.ayat;
  const startIndex = randomInt(0, ayatList.length - 2);
  const currentAyat = ayatList[startIndex];
  const correctAyat = ayatList[startIndex + 1];
  const usedTexts = new Set([currentAyat.teksArab, correctAyat.teksArab]);
  const decoyTexts = [];

  while (decoyTexts.length < 2) {
    const randomIndex = randomInt(0, ayatList.length - 1);
    const candidateText = ayatList[randomIndex].teksArab;

    if (randomIndex !== startIndex && randomIndex !== startIndex + 1 && !usedTexts.has(candidateText)) {
      usedTexts.add(candidateText);
      decoyTexts.push(candidateText);
    }
  }

  const options = shuffle([
    { id: 'opt-1', value: correctAyat.teksArab },
    { id: 'opt-2', value: decoyTexts[0] },
    { id: 'opt-3', value: decoyTexts[1] },
  ]);

  const correctOptionId = options.find((option) => option.value === correctAyat.teksArab)?.id || options[0].id;

  return {
    type: 'sambung-ayat',
    prompt: currentAyat.teksArab,
    options,
    correctOptionId,
    correctValue: correctAyat.teksArab,
  };
}

function renderQuestion() {
  const question = state.currentQuestion;

  if (!question || question.type === 'warning') {
    refs.mentorQuestion.innerHTML = '<p class="empty-state">Pilih surat di menu Al-Qur\'an untuk memulai permainan.</p>';
    refs.mentorChoices.innerHTML = '';
    setFeedback('', 'success');
    return;
  }

  refs.mentorQuestion.innerHTML = `
    <span class="question-label">${question.type === 'tebak-ayat' ? 'Tebak ayat' : 'Sambung ayat'}</span>
    <p class="question-ayat">${question.prompt}</p>
  `;

  refs.mentorChoices.innerHTML = question.options
    .map(
      (option) => `
        <button
          class="choice-btn"
          type="button"
          data-option-id="${option.id}"
          ${state.answered ? 'disabled' : ''}
        >
          ${question.type === 'tebak-ayat' ? `Ayat ${option.value}` : option.value}
        </button>
      `
    )
    .join('');

  refs.mentorChoices.querySelectorAll('.choice-btn').forEach((button) => {
    button.addEventListener('click', () => checkAnswer(button.dataset.optionId));
  });
}

function generateQuestion() {
  if (!state.selectedSurah) {
    setMentorMessage('Pilih surat dari menu Al-Qur\'an terlebih dahulu.', 'info');
    state.currentQuestion = { type: 'warning', message: 'Pilih surat terlebih dahulu.' };
    renderQuestion();
    return;
  }

  const factory = state.currentMode === 'tebak-ayat' ? createTebakAyatQuestion : createSambungAyatQuestion;
  const question = factory();

  if (question.type === 'warning') {
    setMentorMessage(question.message, 'info');
    state.currentQuestion = question;
    renderQuestion();
    return;
  }

  state.currentQuestion = question;
  state.answered = false;
  setFeedback('', 'success');
  refs.mentorStatus.textContent = '';
  refs.mentorStatus.className = 'status';
  renderQuestion();
}

function checkAnswer(selectedOptionId) {
  if (!state.currentQuestion || state.answered) {
    return;
  }

  state.answered = true;
  const buttons = refs.mentorChoices.querySelectorAll('.choice-btn');

  buttons.forEach((button) => {
    const optionId = button.dataset.optionId;
    const isCorrect = optionId === state.currentQuestion.correctOptionId;
    button.disabled = true;

    if (isCorrect) {
      button.classList.add('correct');
    }

    if (optionId === selectedOptionId && !isCorrect) {
      button.classList.add('wrong');
    }
  });

  const isCorrectAnswer = selectedOptionId === state.currentQuestion.correctOptionId;

  if (isCorrectAnswer) {
    state.score += 10;
    updateScore();
    setFeedback('Benar! +10 poin.', 'success');
  } else {
    setFeedback(`Salah. Jawaban benar adalah ${state.currentQuestion.type === 'tebak-ayat' ? `Ayat ${state.currentQuestion.correctValue}` : 'ayat yang tepat.'}`, 'error');
  }
}

function resetQuiz() {
  state.score = 0;
  updateScore();
  setFeedback('', 'success');
  refs.mentorStatus.textContent = '';
  refs.mentorStatus.className = 'status';
  generateQuestion();
}

refs.navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showSection(button.dataset.section);
  });
});

refs.modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    refs.modeButtons.forEach((item) => item.classList.toggle('active', item === button));
    state.currentMode = button.dataset.mode;
    generateQuestion();
  });
});

refs.nextQuestionBtn.addEventListener('click', () => {
  generateQuestion();
});

refs.restartBtn.addEventListener('click', () => {
  resetQuiz();
});

window.addEventListener('DOMContentLoaded', () => {
  updateScore();
  loadSuratList();
  showSection('al-quran');
});
