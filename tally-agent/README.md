# MNG Tally agent

A small program that runs on the Windows server hosting TallyPrime. Every 15 minutes it reads party ledgers, bill-wise outstandings and vouchers from Tally's local XML server (port 9000) and pushes them to MNG over outbound HTTPS. Tally is never exposed to the internet, and the agent only ever *reads* from Tally.

It has no dependencies: copy this folder and run it with Node.js. There's no `npm install`.

## Install (one time, on the Tally server)

1. **TallyPrime:** open the company, then go to **F1 Help → Settings → Connectivity**. Set *TallyPrime acts as* to **Server** (or *Both*) and *Port* to **9000**, then restart Tally. Don't open port 9000 in the Windows firewall; the agent connects to it locally.
2. **Node.js:** install the LTS version from nodejs.org.
3. **Config:** copy this folder to the server, for example `C:\mng-tally-agent`. Copy `config.example.json` to `config.json` and fill in:
   - `mngUrl`: the MNG site address;
   - `syncSecret`: the same value as `TALLY_SYNC_SECRET` in Vercel;
   - `company`: needed only if more than one company is open in Tally.
4. **Check:** in PowerShell in that folder, run:
   ```powershell
   node agent.mjs doctor
   ```
   It checks Tally, the company, and the connection to MNG. It prints counts and percentages only, no party details, so its output is safe to send to the developer.
5. **First sync:** run `node agent.mjs sync`. The first run is a full sync of every voucher since the books began, so it can take several minutes.
6. **Schedule:** from an *Administrator* PowerShell in the folder, run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-task.ps1
   ```

## How it syncs

- **Ledgers and opening bills:** a full snapshot of Sundry Debtors (including subgroups) on every run.
- **Vouchers:** only those whose AlterID is above the last one synced, so edits and new entries arrive within 15 minutes.
- **Full sync** every 24 hours, month by month: catches vouchers that were *deleted* in Tally. Run `node agent.mjs sync --full` to force one.
- Progress goes to `agent.log`, and the last position is kept in `state.json`. Deleting `state.json` forces a full sync.

In MNG's **Tally Accounts** page, a *Balance mismatch* means Tally's closing balance for a party differs from the total of the synced vouchers. That points to a data problem worth investigating.
