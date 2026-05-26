// 画面切り替え用の要素
const viewWelcome = document.getElementById('view-welcome');
const viewCreate = document.getElementById('view-create');
const viewJoin = document.getElementById('view-join');
const viewVoting = document.getElementById('view-voting');

// ボタン・入力欄の要素
const btnHasRoom = document.getElementById('btn-has-room');
const btnNoRoom = document.getElementById('btn-no-room');
const btnSubmitCreate = document.getElementById('btn-submit-create');
const btnGoVoteFromCreate = document.getElementById('btn-go-vote-from-create');
const btnSubmitJoin = document.getElementById('btn-submit-join');
const btnBackFromJoin = document.getElementById('btn-back-from-join');
const btnLeave = document.getElementById('btn-leave');

const inputCreateId = document.getElementById('input-create-id');
const inputJoinId = document.getElementById('input-join-id');
const createError = document.getElementById('create-error');
const joinError = document.getElementById('join-error');
const createSuccess = document.getElementById('create-success');
const displayRoomId = document.getElementById('display-room-id');

// 現在アクティブなルームIDを保持する変数
let currentRoomId = null;

// 表示画面を切り替える関数
function switchView(targetView) {
    [viewWelcome, viewCreate, viewJoin, viewVoting].forEach(view => {
        view.classList.add('hidden');
    });
    targetView.classList.remove('hidden');
}

// 【デモ用初期化】過去にBさんが「1234」を使用していたという状態を再現
if (!localStorage.getItem('travel_rooms')) {
    const mockData = {
        "1234": {
            id: "1234",
            votes: { "北海道": 3, "京都": 1, "沖縄": 2 }
        }
    };
    localStorage.setItem('travel_rooms', JSON.stringify(mockData));
}

// データの読み込み
function getRoomsData() {
    return JSON.parse(localStorage.getItem('travel_rooms')) || {};
}

// データの保存
function saveRoomsData(data) {
    localStorage.setItem('travel_rooms', JSON.stringify(data));
}

// ーーー イベント処理 ーーー

// 「YES」を押したとき（入室画面へ）
btnHasRoom.addEventListener('click', () => {
    joinError.textContent = '';
    inputJoinId.value = '';
    switchView(viewJoin);
});

// 「NO」を押したとき（新規作成画面へ）
btnNoRoom.addEventListener('click', () => {
    createError.textContent = '';
    createSuccess.classList.add('hidden');
    inputCreateId.value = '';
    btnSubmitCreate.classList.remove('hidden');
    switchView(viewCreate);
});

// ルームを新規作成する処理
btnSubmitCreate.addEventListener('click', () => {
    const roomId = inputCreateId.value.trim();
    if (!roomId) {
        createError.textContent = 'ルームIDを入力してください。';
        return;
    }

    const rooms = getRoomsData();
    
    // 【要件】重複チェック
    if (rooms[roomId]) {
        createError.textContent = '既に使われているルームIDです。';
        return;
    }

    // 新しいルームを初期化
    rooms[roomId] = {
        id: roomId,
        votes: { "北海道": 0, "京都": 0, "沖縄": 0 }
    };
    saveRoomsData(rooms);

    currentRoomId = roomId;
    createError.textContent = '';
    btnSubmitCreate.classList.add('hidden');
    createSuccess.classList.remove('hidden');
});

// 作成完了画面から投票画面へ
btnGoVoteFromCreate.addEventListener('click', () => {
    openVotingPage(currentRoomId);
});

// 既存のルームに入室する処理
btnSubmitJoin.addEventListener('click', () => {
    const roomId = inputJoinId.value.trim();
    if (!roomId) {
        joinError.textContent = 'ルームIDを入力してください。';
        return;
    }

    const rooms = getRoomsData();
    
    // ルームが存在するかチェック
    if (!rooms[roomId]) {
        joinError.textContent = '指定されたルームIDは見つかりません。';
        return;
    }

    currentRoomId = roomId;
    openVotingPage(currentRoomId);
});

// 入室画面から初期画面に戻る
btnBackFromJoin.addEventListener('click', () => {
    switchView(viewWelcome);
});

// 投票ページを開く
function openVotingPage(roomId) {
    displayRoomId.textContent = `ID: ${roomId}`;
    switchView(viewVoting);
    renderVotingResults();
}

// 投票ボタンを押した時の処理
document.querySelectorAll('.btn-vote').forEach(button => {
    button.addEventListener('click', (e) => {
        const option = e.target.getAttribute('data-option');
        const rooms = getRoomsData();
        
        if (rooms[currentRoomId]) {
            rooms[currentRoomId].votes[option] += 1;
            saveRoomsData(rooms);
            renderVotingResults();
        }
    });
});

// 投票結果のグラフと数値を画面に描画する
function renderVotingResults() {
    if (!currentRoomId) return;
    
    const rooms = getRoomsData();
    const currentRoom = rooms[currentRoomId];
    if (!currentRoom) return;

    const votes = currentRoom.votes;
    const totalVotes = Object.values(votes).reduce((sum, val) => sum + val, 0);

    // 選択肢ごとにグラフの長さを計算して反映
    const mapping = { '北海道': 'hokkaido', '京都': 'kyoto', '沖縄': 'okinawa' };
    
    Object.keys(mapping).forEach(key => {
        const count = votes[key] || 0;
        const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const domId = mapping[key];

        document.getElementById(`count-${domId}`).textContent = `${count} 票`;
        document.getElementById(`bar-${domId}`).style.width = `${percentage}%`;
    });
}

// ルームを退出する
btnLeave.addEventListener('click', () => {
    currentRoomId = null;
    switchView(viewWelcome);
});

// 【重要】別タブでの更新をリアルタイムに検知するシステム
window.addEventListener('storage', (event) => {
    if (event.key === 'travel_rooms') {
        renderVotingResults();
    }
});
}
