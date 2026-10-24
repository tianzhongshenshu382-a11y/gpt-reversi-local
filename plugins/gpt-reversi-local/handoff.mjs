// One explicit user click -> one black move -> one chat message.
// There is deliberately no move generator or automatic retry of chat messages.
export function createHandoff({ callTool, sendMessage, update, setBusy, onError }) {
  let busy = false;
  const sent = new Set();
  const notify = async state => {
    if (state.turn !== 'W') return;
    const key = `${state.gameId}:${state.revision}`;
    if (sent.has(key)) return;
    const prompt = `オセロの手番です。対局ID: ${state.gameId}、黒の着手後の盤面版: ${state.revision}。reversi_read_boardでこの対局の最新の盤面を確認し、白の一手をあなた自身で考えてreversi_play_whiteで着手してください。白が続けて手番なら続け、黒の手番または対局終了で止めてください。`;
    const response = await sendMessage(prompt);
    if (response?.isError) throw Error('ChatGPTが手番の依頼を受け付けませんでした。');
    sent.add(key);
  };
  return {
    async play(state, cell) {
      if (busy || state?.turn !== 'B' || !state.legalMoves.includes(cell)) return;
      busy = true; setBusy(true);
      try {
        const response = await callTool('reversi_human_move', { gameId: state.gameId, cell, expectedRevision: state.revision, commandId: crypto.randomUUID() });
        if (response?.isError) throw Error(response.content?.[0]?.text || '着手できませんでした。');
        const next = response?.structuredContent;
        if (!next?.gameId) throw Error('更新した盤面を受信できませんでした。');
        update(next);
        await notify(next);
      } catch (error) { onError(error); }
      finally { busy = false; setBusy(false); }
    },
    async retry(state) {
      if (busy) return;
      busy = true; setBusy(true);
      try { sent.delete(`${state.gameId}:${state.revision}`); await notify(state); }
      catch (error) { onError(error); }
      finally { busy = false; setBusy(false); }
    },
  };
}
