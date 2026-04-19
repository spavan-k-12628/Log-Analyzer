// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════
function esc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════════════════
(function(){
  var isDark = false;
  document.getElementById('themeToggle').addEventListener('click', function(){
    isDark = !isDark;
    document.body.classList.toggle('dark', isDark);
    document.getElementById('opt-light').classList.toggle('active', !isDark);
    document.getElementById('opt-dark').classList.toggle('active', isDark);
  });
})();

// ═══════════════════════════════════════════════════════════
//  FILE UPLOAD & DRAG DROP
// ═══════════════════════════════════════════════════════════
var _uploadedFileName = null;
function readFile(file){
  _uploadedFileName = file.name;
  var r = new FileReader();
  r.onload = function(ev){
    document.getElementById('logInput').value = ev.target.result;
    var b = document.getElementById('fileBadge');
    b.textContent = '✓ ' + file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)';
    b.classList.remove('hidden');
    onInputChange();
  };
  r.onerror = function(){ alert('Could not read file. Try pasting directly.'); };
  r.readAsText(file);
}
// uploadBtn replaced by <label for='fileInput'>
document.getElementById('fileInput').addEventListener('change', function(){
  if (this.files && this.files[0]) readFile(this.files[0]);
});
(function(){
  var dz = document.getElementById('dropZone');
  dz.addEventListener('dragover',  function(e){ e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', function(){ dz.classList.remove('over'); });
  dz.addEventListener('dragend',   function(){ dz.classList.remove('over'); });
  dz.addEventListener('drop', function(e){
    e.preventDefault(); dz.classList.remove('over');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });
})();
function onInputChange(){
  var txt = document.getElementById('logInput').value;
  var n = txt.split('\n').filter(function(l){ return l.trim(); }).length;
  var lcEl = document.getElementById('lineCount');
  var hintEl = document.getElementById('analyzeHint');
  var hasInput = !!txt.trim();
  lcEl.innerHTML = hasInput
    ? '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg> <strong style="color:var(--text);">'+n.toLocaleString()+'</strong> lines loaded'
    : '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg> No log loaded yet';
  if (hintEl) hintEl.style.display = hasInput ? 'none' : 'inline';
  document.getElementById('analyzeBtn').disabled = !hasInput;
}
document.getElementById('logInput').addEventListener('input', onInputChange);


// ═══════════════════════════════════════════════════════════
//  LOG LEVEL DETECTION  (bracket-tag first, no loose fallback)
// ═══════════════════════════════════════════════════════════
var LEVEL_SKIP = new Set(['error','warn','warning','info','information','debug',
  'trace','fatal','critical','notice','verbose','severe','alert','emergency','exception','err','inf','dbg','wrn']);

function getLevel(line){
  // ── macOS Crash Report signals ──
  if (/^Exception Type:.*EXC_CRASH|SIGABRT|SIGSEGV|SIGBUS|SIGILL|SIGFPE/i.test(line)) return 'fatal';
  if (/^Termination Reason:/i.test(line))  return 'fatal';
  if (/^Thread \d+ Crashed/i.test(line))  return 'fatal';
  if (/^abort\(\)\s*called/i.test(line)) return 'fatal';
  if (/SOME_OTHER_THREAD_SWALLOWED_AT_LEAST_ONE_EXCEPTION/i.test(line)) return 'error';
  if (/^Exception Codes:/i.test(line))     return 'error';
  if (/^Application Specific Information:/i.test(line)) return 'warn';
  if (/^Triggered by Thread:/i.test(line)) return 'warn';
  // ── Windows Trident: [timestamp][threadId][Level][Class.Method:line] ──
  var winM = line.match(/^\[\d{4}[\/ ]\d{2}[\/ ]\d{2}[\s\/ ]\d{2}:\d{2}:\d{2}[.\d]*\]\[[^\]]*\]\[([A-Za-z]+)\]/);
  if (winM) {
    var lv = winM[1].toLowerCase();
    if (lv === 'fatal')                              return 'fatal';
    if (lv === 'error')                              return 'error';
    if (lv === 'warn' || lv === 'warning')           return 'warn';
    if (lv === 'info' || lv === 'debug' || lv === 'trace' || lv === 'verbose') return 'info';
  }
  // ── Standard bracketed level tags ──
  if (/\[Fatal\]/i.test(line))                               return 'fatal';
  if (/\[Error\]/i.test(line))                               return 'error';
  if (/\[Warn(?:ing)?\]/i.test(line))                        return 'warn';
  if (/\[(?:Info|Debug|Trace|Verbose|Notice)\]/i.test(line)) return 'info';

  // ── Mac log format: level encoded in context tag and message body ──
  // Zoho Trident context tags: :[TagName] between method signature and message
  if (/:\[AssertionFailure\]/i.test(line))      return 'error';
  if (/:\[Crash\]/i.test(line))                 return 'fatal';
  if (/:\[FatalError\]/i.test(line))            return 'fatal';
  if (/:\[Warning\]/i.test(line))               return 'warn';
  // Zoho _Error suffix tags: [SaveDraft_Error], [Sync_Error], [Network_Error], etc.
  if (/:\[[A-Za-z]+_Error\]/i.test(line))       return 'error';
  // Zoho _Fatal suffix tags
  if (/:\[[A-Za-z]+_Fatal\]/i.test(line))       return 'fatal';
  // Zoho _Warning / _Warn suffix tags
  if (/:\[[A-Za-z]+_Warn(?:ing)?\]/i.test(line)) return 'warn';

  // Extract the quoted message body: ["..."] at end of Mac log line
  var msgMatch = line.match(/\[\"(.+)\"\]\s*$/);
  var msg = msgMatch ? msgMatch[1] : '';
  // Also check raw line content for inline patterns
  var fullText = msg || line;

  // Error Domain / NSError patterns (Mac/iOS specific)
  if (/Error Domain=/i.test(fullText) && !/Code=1001/.test(fullText)) return 'error'; // 1001 = "up to date" - not real error
  if (/errorCode\s*:\s*(?!0\b)\d+/i.test(fullText)) return 'error'; // errorCode: 3840 etc (non-zero = error)
  if (/NSError|NSException/i.test(fullText))    return 'error';

  // Message-body keyword signals
  if (/\b(crash|fatal|critical)\b/i.test(fullText)) return 'fatal';
  if (/\b(assert|assertion)\s*fail/i.test(fullText)) return 'error';
  if (/Error Response/i.test(fullText))          return 'error';
  if (/\bunable to\b/i.test(fullText))          return 'warn';
  if (/\bUnsupported\b/i.test(fullText))        return 'warn';
  if (/\bfailed\b/i.test(fullText))             return 'error';
  if (/\bdenied\b/i.test(fullText))             return 'error';
  if (/\btimeout\b/i.test(fullText))            return 'warn';
  // ── macOS Crash Report body signals ──
  if (/EXC_CRASH|EXC_BAD_ACCESS|EXC_BAD_INSTRUCTION|EXC_ARITHMETIC/i.test(fullText)) return 'fatal';
  if (/SIGABRT|SIGSEGV|SIGBUS|SIGILL|SIGFPE/i.test(fullText))   return 'fatal';
  if (/abort trap|abort\(\)/i.test(fullText))                   return 'fatal';
  if (/SOME_OTHER_THREAD_SWALLOWED_AT_LEAST_ONE_EXCEPTION/i.test(fullText)) return 'error';
  if (/insertRowsAtIndexes.*NSTableRowData|NSOutlineView.*insertItems/i.test(fullText)) return 'error';
  if (/ChatboxViewController.*chatboxViewModelDidAddItems/i.test(fullText)) return 'error';
  if (/ZCChatboxViewModel.*addProgress/i.test(fullText)) return 'error';
  if (/NSInternalInconsistencyException|_userInfoForFileAndLine/i.test(fullText)) return 'error';
  if (/Kotlin.*TerminateHandler|kotlinHandler/i.test(fullText))  return 'error';
  if (/ZCFontStyleParser|ZCMessageModel.*attributedMessage/i.test(fullText)) return 'warn';
  if (/scrollBoundsChanged|handleTopProgress/i.test(fullText))   return 'warn';
  if (/deduplicated_symbol/i.test(fullText))                     return 'info';
  // ── Windows Trident-specific signals ──
  if (/DB connection not initialized/i.test(fullText))          return 'fatal';
  if (/attempt to write a readonly database/i.test(fullText))   return 'fatal';
  if (/HostNameNotResolved/i.test(fullText))                    return 'error';
  if (/ConnectionAborted/i.test(fullText))                      return 'error';
  if (/WebSocketError:\s*Timeout/i.test(fullText))              return 'error';
  if (/OauthException|Invalid accessToken/i.test(fullText))     return 'error';
  if (/Object reference not set to an instance/i.test(fullText)) return 'error';
  if (/Input string was not in a correct format/i.test(fullText)) return 'error';
  if (/FileNotFoundException|cannot find the file/i.test(fullText)) return 'error';
  if (/Shared Folder fetch failed/i.test(fullText))             return 'warn';
  if (/Profile pic not found in server/i.test(fullText))        return 'warn';
  if (/UseCaseCallback\.OnFailed/i.test(fullText))              return 'warn';
  if (/Total Number Of.*Downloads.*[5-9]\d*/i.test(fullText))  return 'warn';
  if (/No WebSocket action handler found/i.test(fullText))      return 'info';
  if (/Pong received/i.test(fullText))                          return 'info';
  if (/Exception from HRESULT/i.test(fullText))                 return 'error';
  // ── Zoho Trident-specific signals ──
  if (/Error code:\s*[1-9]/i.test(fullText))     return 'error';  // SQLite "Error code: 1"
  if (/Socket is not connected/i.test(fullText))  return 'error';  // WebSocket disconnect
  if (/incomplete input/i.test(fullText))         return 'error';  // SQLite parse error
  if (/\bnil\b.*nil\b.*nil\b/i.test(fullText))  return 'warn';   // triple nil - suspicious state
  if (/conversation summary nil/i.test(fullText)) return 'warn';   // draft nil summary
  if (/mail list not found/i.test(fullText))      return 'warn';   // delivery status miss
  if (/Extension is not found for image/i.test(fullText)) return 'warn'; // inline image issue
  if (/unable to parse/i.test(fullText))          return 'warn';   // calendar parse fail
  if (/Digest value not found/i.test(fullText))   return 'warn';   // missing digest
  if (/retryCount:\s*[3-9]/i.test(fullText))     return 'warn';   // max retries hit
  if (/status: [2-9]\b/i.test(fullText) && /exeCount/i.test(fullText)) return 'warn'; // failed tx

  // Plain-text level token right after timestamp
  var prefix = line.replace(/^(?:\[.*?\]\s*)*/,'').replace(/^\d{4}[-\/]\d{2}[-\/]\d{2}[\sT]\d{2}:\d{2}(?::\d{2})?(?:[.:\,]\d+)?\s*/,'').slice(0,20);
  if (/^FATAL\b/i.test(prefix))                      return 'fatal';
  if (/^ERROR\b/i.test(prefix))                      return 'error';
  if (/^WARN(?:ING)?\b/i.test(prefix))               return 'warn';
  if (/^(?:INFO|DEBUG|TRACE|VERBOSE)\b/i.test(prefix)) return 'info';

  return 'info'; // Mac logs — everything is info unless signals above matched
}

function getTimestamp(line){
  // macOS crash report: "Date/Time:   2026-02-26 11:21:24.9352 +0530"
  var crashTs = line.match(/^Date\/Time:\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
  if (crashTs) return crashTs[1];
  // Windows Trident: [2026/01/30 12:03:23.943] or [2026 02 16 15:17:38.635]
  var winT = line.match(/^\[(\d{4}[\/\s]\d{2}[\/\s]\d{2}[\/\s]\d{2}:\d{2}:\d{2}[.\d]*)/);
  if (winT) return winT[1];
  // Mac/standard formats
  var m = line.match(/\d{4}[-\/]\d{2}[-\/]\d{2}[\sT]\d{2}:\d{2}:\d{2}[:.\,]\d+/)
       || line.match(/\d{4}[-\/]\d{2}[-\/]\d{2}[\sT]\d{2}:\d{2}(?::\d{2})?/);
  return m ? m[0] : null;
}

function getSource(line){
  // macOS crash report backtrace frame: "  N   ModuleName   0xaddr SymbolName + offset"
  var crashFrame = line.match(/^\s*\d+\s+([A-Za-z][\w.\-+]{2,40})\s+0x[0-9a-fA-F]+/);
  if (crashFrame) return crashFrame[1];
  // macOS crash report key/value: "Exception Type:  EXC_CRASH"
  var crashKV = line.match(/^([A-Za-z][\w /]+):\s+/);
  if (crashKV && /exception|termination|triggered|thread.*crash/i.test(crashKV[1])) return crashKV[1].trim();
  // Windows Trident: [timestamp][threadId][Level][ClassName.Method:line] msg
  var winSrc = line.match(/^\[\d{4}[\/ ][^\]]+\]\[[^\]]*\]\[[A-Za-z]+\]\[([A-Za-z][\w.+<>]{2,80}):\d+\]/);
  if (winSrc) {
    var parts = winSrc[1].split('.');
    return parts[parts.length - 1].split('+')[0];
  }
  // Mac format: timestamp [ClassName:lineNum] method():[ContextTag] ["msg"]
  // Try to grab the FIRST [Word:digits] token = ClassName
  var macMatch = line.match(/^\d{4}[-\/]\d{2}[-\/]\d{2}[\sT]\d{2}:\d{2}:\d{2}[:.\,\d]+\s+\[([A-Za-z][\w]{2,60}):\d+\]/);
  if (macMatch) return macMatch[1];

  // Standard bracketed format
  var matches = line.match(/\[([A-Za-z][\w.]{2,60}(?::\d+)?)\]/g);
  if (!matches) return null;
  for (var i=0;i<matches.length;i++){
    var token = matches[i].slice(1,-1).trim();
    if (/^\d+$/.test(token)) continue;
    if (LEVEL_SKIP.has(token.toLowerCase())) continue;
    if (/^\d{2}:\d{2}/.test(token)) continue;
    if (/^[A-Za-z][\w]+:\d+$/.test(token)) return token.replace(/:\d+$/,''); // Class:line
    return token.replace(/:\d+$/,'');
  }
  return null;
}
function getClassName(src){ return src ? src.split('.')[0] : null; }

// ═══════════════════════════════════════════════════════════
//  ZEALAND (ZUID) & ACCOUNT ID EXTRACTION
// ═══════════════════════════════════════════════════════════
function extractIds(lines){
  // Captures log-style and JSON-style account identifiers.
  var q = '(?:\\\\)?"';
  var zuidRe  = new RegExp('(?:\\b(?:ZUID|OwnerZUID|zuid)\\b\\s*[:=]\\s*|' + q + '(?:ZUID|OwnerZUID|zuid)' + q + '\\s*:\\s*' + q + '?)(\\d{6,20})' + q + '?', 'gi');
  var accRe   = new RegExp('(?:\\b(?:Acc(?:ount)?Id|AccountId|account\\s+id)\\b\\s*[:=]\\s*|' + q + '(?:Acc(?:ount)?Id|AccountId)' + q + '\\s*:\\s*' + q + '?)(\\d{6,20})' + q + '?', 'gi');

  var zuids = {}, accs = {};

  lines.forEach(function(line, idx){
    var m;
    zuidRe.lastIndex = 0;
    while ((m = zuidRe.exec(line)) !== null){
      var val = m[1];
      if (!zuids[val]) zuids[val] = { value:val, lines:[], contexts:[] };
      zuids[val].lines.push(idx+1);
      zuids[val].contexts.push(line.trim().slice(0,120));
    }
    accRe.lastIndex = 0;
    while ((m = accRe.exec(line)) !== null){
      var val = m[1];
      if (!accs[val]) accs[val] = { value:val, lines:[], contexts:[] };
      accs[val].lines.push(idx+1);
      accs[val].contexts.push(line.trim().slice(0,120));
    }
  });

  return {
    zuids: Object.values(zuids),
    accs:  Object.values(accs)
  };
}

function renderIdTable(items, label, color){
  if (!items.length){
    return '<div class="empty-state"><div class="empty-icon">–</div><div class="empty-title">No '+esc(label)+' found</div></div>';
  }
  var rows = items.map(function(item){
    var lineNums = item.lines.slice(0,5).join(', ') + (item.lines.length>5?' … +' + (item.lines.length-5)+' more':'');
    // Show up to 2 contexts
    var ctxHtml = item.contexts.slice(0,2).map(function(ctx){
      return '<div style="font-size:11px;color:var(--dim);margin-top:3px;word-break:break-all;">'+esc(ctx)+'</div>';
    }).join('');
    return '<tr>' +
      '<td><span class="id-pill" style="background:'+color+'22;color:'+color+';">'+esc(item.value)+'</span></td>' +
      '<td><span style="color:var(--muted);font-size:12px;">'+esc(lineNums)+'</span></td>' +
      '<td>' + ctxHtml + '</td>' +
    '</tr>';
  }).join('');

  return '<div style="font-size:12px;color:var(--dim);margin-bottom:12px;">'+items.length+' unique '+esc(label)+' value(s) found across the log.</div>' +
    '<div style="overflow-x:auto;"><table class="id-table">' +
    '<thead><tr><th>'+esc(label)+'</th><th>Line(s)</th><th>Context</th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table></div>';
}

// ═══════════════════════════════════════════════════════════
//  RICH ERROR CATEGORIES
// ═══════════════════════════════════════════════════════════
var ERROR_CATEGORIES = [
  { key:'runtime',  label:'Runtime Exceptions',        color:'#ef4444', bg:'#fef2f2',
    patterns:[/\bNullReferenceException\b/i,/\bNullPointerException\b/i,/\bIndexOutOfRange(?:Exception)?\b/i,
      /\bArrayIndexOutOfBounds(?:Exception)?\b/i,/\bInvalidOperationException\b/i,/\bIllegalStateException\b/i,
      /\bArgumentException\b/i,/\bTypeError\b/i,/\bValueError\b/i,/\bRuntimeException\b/i,/\bSystemException\b/i] },
  { key:'auth',     label:'Auth & Authorization',      color:'#f97316', bg:'#fff7ed',
    patterns:[/\b401\b.*[Uu]nauthorized/,/\b403\b.*[Ff]orbidden/,/\b403\b/,
      /[Aa]uthentication\s+failed/i,/[Aa]uthorization\s+failed/i,/[Aa]ccess\s+denied/i,
      /[Tt]oken\s+expired/i,/[Ii]nvalid\s+token/i,/[Ii]nvalid\s+credentials/i,
      /[Ss]ession\s+expired/i,/CSRF\s+validation\s+failed/i] },
  { key:'database', label:'Database Errors',           color:'#3b82f6', bg:'#eff6ff',
    patterns:[/\bSQLException\b/i,/\bSQLTimeoutException\b/i,/[Dd]eadlock\s+(?:detected|victim)/i,
      /[Cc]onnection\s+pool\s+exhausted/i,/[Tt]oo\s+many\s+connections/i,/[Qq]uery\s+timeout/i,
      /[Tt]ransaction\s+rolled\s+back/i,/[Cc]onstraint\s+violation/i,/[Pp]rimary\s+key\s+violation/i,
      /[Ff]oreign\s+key\s+violation/i,/[Dd]uplicate\s+entry/i,/[Dd]atabase\s+unavailable/i] },
  { key:'perf',     label:'Performance Issues',        color:'#eab308', bg:'#fefce8',
    patterns:[/\bOutOfMemoryException\b/i,/[Oo]ut\s+of\s+memory/i,/[Mm]emory\s+leak\s+detected/i,
      /[Hh]igh\s+CPU\s+usage/i,/[Tt]hread\s+blocked/i,/[Tt]hread\s+starvation/i,
      /[Rr]esource\s+exhaustion/i,/[Rr]ate\s+limit\s+exceeded/i,/\bThrottling\b/i,
      /[Ss]ervice\s+unavailable/i,/\b503\b/] },
  { key:'fileio',   label:'File / IO Errors',          color:'#8b5cf6', bg:'#f5f3ff',
    patterns:[/[Ff]ile\s+not\s+found/i,/[Aa]ccess\s+is\s+denied/i,/[Pp]ermission\s+denied/i,
      /\bIOException\b/i,/[Dd]isk\s+full/i,/[Rr]ead.only\s+file\s+system/i,
      /[Pp]ath\s+not\s+found/i,/[Ff]ile\s+corruption\s+detected/i] },
  { key:'http',     label:'API / HTTP Errors',         color:'#10b981', bg:'#ecfdf5',
    patterns:[/\b400\b.*[Bb]ad\s+[Rr]equest/,/\b404\b/,/\b405\b/,/\b408\b/,/\b409\b/,
      /\b415\b/,/\b422\b/,/\b429\b/,/\b500\b/,/\b502\b/,/\b504\b/] },
  // ── Zoho Trident-specific categories ──
  { key:'sqlite',   label:'SQLite / DB Errors',          color:'#f59e0b', bg:'#fffbeb',
    patterns:[/Error code:\s*[1-9]/i,/incomplete input/i,/\bZSqliteHelper\b/i,
      /sqlite.*error/i,/sql.*exception/i,/database.*locked/i,/no such table/i] },
  { key:'sync',     label:'Sync / Transaction Failures', color:'#6366f1', bg:'#eef2ff',
    patterns:[/retryCount:\s*[3-9]/i,/status:\s*[2-9].*exeCount/i,
      /transaction.*failed/i,/sync.*error/i,/\bZSyncManager\b/i,
      /SaveDraft_Error/i,/Send_Error/i,/Fetch_Error/i,/\bZComposeSyncManager\b/i] },
  { key:'network',  label:'Network / Socket Errors',     color:'#0ea5e9', bg:'#f0f9ff',
    patterns:[/Socket is not connected/i,/network.*error/i,/connection.*failed/i,
      /onDisconnect/i,/WebSocket.*close/i,/\bPexConnectionManager\b/i,
      /The operation couldn.*t be completed.*[Ss]ocket/i] },
  { key:'calendar', label:'Calendar Parse Errors',       color:'#ec4899', bg:'#fdf2f8',
    patterns:[/unable to parse calendar/i,/\bZCalCalendarParser\b/i,
      /invalid.*ical/i,/calendar.*format/i,/getCalType/i] },
  { key:'draft',    label:'Draft / Compose Issues',      color:'#84cc16', bg:'#f7fee7',
    patterns:[/SaveDraft_Error/i,/conversation summary nil/i,/thread mail not found/i,
      /\bZMailComposeDataManager\b/i,/\bZMailComposeSyncManager\b/i,
      /draft.*fail/i,/compose.*error/i] },
  // ── Windows Trident-specific categories ──
  { key:'dbinit',   label:'DB Init / Connection Errors',  color:'#dc2626', bg:'#fef2f2',
    patterns:[/DB connection not initialized/i,/attempt to write a readonly database/i,
      /InvalidOperationException.*DB/i,/SQLite.*readonly/i,/InitializeUser.*Error/i,
      /DB connection not initialized for Id/i] },
  { key:'oauth',    label:'OAuth / Token Errors',         color:'#ea580c', bg:'#fff7ed',
    patterns:[/OauthException/i,/Invalid accessToken/i,/PasswordVaultManager.*failed/i,
      /CheckAndValidateAuthenticationError/i,/Get Credentials failed/i] },
  { key:'wssocket', label:'WebSocket Errors',             color:'#7c3aed', bg:'#f5f3ff',
    patterns:[/WebSocketError:\s*(Timeout|HostNameNotResolved|ConnectionAborted|Unknown)/i,
      /Error in receiving WebSocket message/i,/Error in sending message via WebSocket/i,
      /Error in connecting WebSocket/i,/remote party closed the WebSocket/i,
      /Websocket was disconnected/i,/HostNameNotResolved/i,/ConnectionAborted/i,
      /Exception from HRESULT: 0x80072E/i] },
  { key:'filenotfound', label:'File / Resource Not Found', color:'#0891b2', bg:'#ecfeff',
    patterns:[/FileNotFoundException/i,/cannot find the file specified/i,
      /Shared Folder fetch failed ResourceNotFound/i,/Error loading Uri/i,
      /ResourceNotFound/i,/Profile pic not found in server/i] },
  { key:'nullref',  label:'Null Reference Errors',        color:'#be185d', bg:'#fdf2f8',
    patterns:[/NullReferenceException/i,/Object reference not set to an instance/i,
      /Exception while running on UI thread.*NullReference/i,
      /DownloadInlineImage.*NullReference/i] },
  { key:'parsewin', label:'Parse / Format Errors',        color:'#b45309', bg:'#fffbeb',
    patterns:[/Input string was not in a correct format/i,
      /StreamsDataParser.*ParseNotificationContent/i,/Streams Error in parsing post/i,
      /Error in StreamsDataParser/i] },
  // ── macOS Crash Report categories ──
  { key:'appcrash',  label:'App Crash (SIGABRT/EXC)',    color:'#7a0000', bg:'#fff0f0',
    patterns:[/EXC_CRASH|EXC_BAD_ACCESS|EXC_BAD_INSTRUCTION/i,/SIGABRT|SIGSEGV|SIGBUS|SIGILL/i,
      /abort trap|abort\(\) called/i,/Termination Reason.*SIGNAL/i,/Thread \d+ Crashed/i] },
  { key:'uitablecrash', label:'UI Table / Outline Crash', color:'#991b1b', bg:'#fef2f2',
    patterns:[/insertRowsAtIndexes.*NSTableRowData/i,/NSOutlineView.*insertItems/i,
      /NSTableRowData.*insertRows/i,/chatboxViewModelDidAddItems/i,
      /NSInternalInconsistencyException/i,/_userInfoForFileAndLine/i] },
  { key:'kotlincrash', label:'Kotlin / KMM Runtime Crash', color:'#92400e', bg:'#fffbeb',
    patterns:[/TerminateHandler.*kotlin/i,/kotlinHandler/i,/ZohoCRMCore.*terminate/i,
      /SchemaSdk.*TerminateHandler/i,/KSCrash/i,/kotlin.*runBlocking/i] },
  { key:'uithread',  label:'Main Thread Violations',    color:'#5b21b6', bg:'#f5f3ff',
    patterns:[/Triggered by Thread: 0/i,/com\.apple\.main-thread/i,
      /scrollBoundsChanged|handleTopProgress/i,/ChatboxViewController\.scroll/i,
      /SOME_OTHER_THREAD_SWALLOWED/i] },
];

// Dark-mode bg overrides for category cards
var CAT_BG_DARK = { runtime:'#2d0a0a',auth:'#2d1500',database:'#0a1526',perf:'#1a1400',fileio:'#150a2d',http:'#0a1a12',sqlite:'#1a1000',sync:'#0d0e2a',network:'#00131a',calendar:'#2a001a',draft:'#0a1500',dbinit:'#2d0a0a',oauth:'#2d1500',wssocket:'#1a0a2d',filenotfound:'#001a1a',nullref:'#2a0018',parsewin:'#1a1200' ,appcrash:'#2d0000',uitablecrash:'#2d0000',kotlincrash:'#1a1000',uithread:'#160a2d'};

function detectCategory(line){
  if (/^\s*at\s+/.test(line)) return null;
  var msgBody = line.replace(/^(?:\[.*?\]\s*)+/,'').trim();
  for (var i=0;i<ERROR_CATEGORIES.length;i++){
    var cat = ERROR_CATEGORIES[i];
    for (var j=0;j<cat.patterns.length;j++){
      if (cat.patterns[j].test(msgBody)) return cat.key;
    }
  }
  return null;
}

var GEN_PATTERNS = {
  timeout:/\b(timeout|timed.?out|connection.refused)\b/i,
  memory:/\b(memory|heap|oom|out.of.memory)\b/i,
  network:/\b(network|dns|socket|upstream|gateway|proxy)\b/i,
  restart:/\b(restart(ed)?|reboot|reload)\b/i,
  // Zoho Trident-specific patterns
  nilState:/\bconversation summary nil\b|\bmail list not found\b|\bthread mail not found\b/i,
  retryExhausted:/retryCount:\s*[3-9]\d*/i,
  sqliteError:/Error code:\s*[1-9]|incomplete input/i,
  socketDisconnect:/Socket is not connected|onDisconnect/i,
  inlineImageError:/Extension is not found for image|isValidFileType false/i,
  calendarParseFail:/unable to parse calendar type/i,
  draftSyncError:/SaveDraft_Error|conversation summary nil/i,
  // Windows Trident patterns
  dbConnectionFail:/DB connection not initialized|readonly database/i,
  oauthTokenFail:/OauthException|Invalid accessToken|Get Credentials failed/i,
  wsTimeout:/WebSocketError:\s*(Timeout|HostNameNotResolved|ConnectionAborted)/i,
  nullRefException:/NullReferenceException|Object reference not set/i,
  fileNotFound:/FileNotFoundException|cannot find the file|ResourceNotFound/i,
  parseFormatError:/Input string was not in a correct format|ParseNotificationContent/i,
  downloadQueueHigh:/Total Number Of.*Downloads.*[5-9]\d*/i,
  // macOS Crash Report patterns
  sigabrtCrash:/SIGABRT|EXC_CRASH.*SIGABRT/i,
  excBadAccess:/EXC_BAD_ACCESS/i,
  abortCalled:/abort\(\)\s*called/i,
  uiTableCrash:/insertRowsAtIndexes.*NSTableRowData|NSOutlineView.*insertItems/i,
  kotlinTerminate:/TerminateHandler.*kotlin|kotlinHandler/i,
  kscrashDetected:/KSCrash/i,
  mainThreadCrash:/Triggered by Thread:\s*0/i,
  swallowedException:/SOME_OTHER_THREAD_SWALLOWED_AT_LEAST_ONE_EXCEPTION/i,
  scrollHandlerCrash:/scrollBoundsChanged|chatboxViewModelDidAddItems/i,
  mailDeliveryMiss:/mail list not found for messageIds/i,
  digestMissing:/Digest value not found/i,
  labelInfoMissing:/Sensitive Label Info not found/i,
};

// ═══════════════════════════════════════════════════════════
//  PARSE ENTRIES
// ═══════════════════════════════════════════════════════════
function isHeader(line){
  // macOS crash report key lines
  if (/^Exception Type:/i.test(line))      return true;
  if (/^Exception Codes:/i.test(line))     return true;
  if (/^Termination Reason:/i.test(line))  return true;
  if (/^Triggered by Thread:/i.test(line)) return true;
  if (/^Thread \d+ Crashed/i.test(line))   return true;
  if (/^abort\(\)\s*called/i.test(line))   return true;
  if (/^Process:\s+\S+.*\[\d+\]/.test(line)) return true;
  if (/SOME_OTHER_THREAD_SWALLOWED_AT_LEAST_ONE_EXCEPTION/.test(line)) return true;
  // Standard: starts with [bracket]
  // Mac format: starts with YYYY-MM-DD HH:MM:SS:mmm [Class:line] method():[Tag] ["msg"]
  // Windows Trident format: [2026/01/30 12:03:23.943][threadId][Level][Class.Method:line] msg
  // Windows Trident alt:    [2026 02 16 15:17:38.635][][Level][Class.Method:line] msg
  if (/^\[\d{4}[\/ ]\d{2}[\/ ]\d{2}[\/ ]\d{2}:\d{2}:\d{2}/.test(line)) return true;
  if (/^\[.*?\]/.test(line)) return true;
  if (/^\d{4}[-\/]\d{2}[-\/]\d{2}[\sT]\d{2}:\d{2}/.test(line)) return true;
  return false;
}
function parseEntries(raw){
  var lines = raw.split('\n'), entries = [], i = 0;
  while (i < lines.length){
    var line = lines[i];
    if (isHeader(line)){
      var body=[line], j=i+1;
      while (j<lines.length && !isHeader(lines[j])){ if(lines[j].trim()) body.push(lines[j]); j++; }
      entries.push({ header:line, body:body, level:getLevel(line), cat:detectCategory(line) });
      i = j;
    } else { i++; }
  }
  return entries;
}

// ═══════════════════════════════════════════════════════════
//  GROUPING
// ═══════════════════════════════════════════════════════════
function getExcInfo(line){
  // Exception type patterns
  var m = line.match(/\bEx(?:ception)?:\s*([\w.]+(?:Exception|Error|TypeError|ValueError)[\w.]*):\s*(.+)/i)
         || line.match(/([\w.]+(?:Exception|Error|TypeError|ValueError)):\s*(.+)/i);
  if (m) return { type:m[1], msg:m[2].trim() };

  // Mac format: extract message from ["..."] at end of line
  var macMsg = line.match(/\[\"(.{4,})\"\]\s*$/);
  if (macMsg) return { type:null, msg:macMsg[1].trim() };

  // Mac format: Error Domain= pattern
  var errDomain = line.match(/Error Domain=(\S+).*?description:\s*([^"\}]+)/i);
  if (errDomain) return { type:errDomain[1], msg:errDomain[2].trim() };

  var body = line.replace(/^(?:\[.*?\]\s*)+/,'').trim();
  return { type:null, msg:body||line.trim() };
}
function groupBy(entries, filterFn){
  var filtered=entries.filter(filterFn), groups={}, order=[];
  filtered.forEach(function(e){
    var exc=getExcInfo(e.header);
    var key=(exc.type||'')+'||'+exc.msg.slice(0,100);
    if (!groups[key]){
      groups[key]={ excType:exc.type, msg:exc.msg, source:getSource(e.header),
        category:e.cat, firstSeen:getTimestamp(e.header), lastSeen:getTimestamp(e.header),
        stack:e.body.slice(1), count:0 };
      order.push(key);
    }
    var g=groups[key]; g.count++;
    g.lastSeen=getTimestamp(e.header)||g.lastSeen;
    if (!g.stack.length && e.body.length>1) g.stack=e.body.slice(1);
  });
  return { total:filtered.length, groups:order.map(function(k){ return groups[k]; }) };
}

// ═══════════════════════════════════════════════════════════
//  RENDER CARDS
// ═══════════════════════════════════════════════════════════
function renderStack(lines){
  return lines.map(function(l){
    var t=l.trim();
    if (t.indexOf('at ')===0){
      var inIdx=t.indexOf(' in '); var method=inIdx>-1?t.slice(3,inIdx):t.slice(3); var loc=inIdx>-1?t.slice(inIdx+4):'';
      return '<span class="stack-at">at </span><span class="stack-method">'+esc(method)+'</span>'+(loc?'<span class="stack-loc"> in '+esc(loc)+'</span>':'');
    }
    return esc(l);
  }).join('\n');
}
var _sid=0;

// ── SEARCH / FILTER STATE ──
var _allEntries = [];
var _rawLines = [];
var _filterQ = '';
var _tabPermanentRenderers = {};
function filteredEntries(){
  if (!_filterQ) return _allEntries;
  var q=_filterQ.toLowerCase();
  return _allEntries.filter(function(e){
    return e.body.some(function(l){ return l.toLowerCase().indexOf(q)>=0; });
  });
}
function buildProgressRing(pct, color){
  var r=13,cx=18,cy=18,size=36;
  var circ=2*Math.PI*r;
  var val=Math.min(100,Math.max(0,parseFloat(pct)||0));
  var dash=(val/100)*circ;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="display:block;">'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--border)" stroke-width="2.5"/>'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="2.5"'
    +' stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" stroke-linecap="round"'
    +' transform="rotate(-90 '+cx+' '+cy+')"/>'
    +'<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-size="7.5" font-weight="700"'
    +' font-family="-apple-system,system-ui,sans-serif" fill="'+color+'">'+val+'%</text>'
    +'</svg>';
}
function buildSparkline(entries, level, color){
  var filtered=entries.filter(function(e){ return e.level===level; });
  if (filtered.length<2) return '';
  var buckets={};
  filtered.forEach(function(e){
    var ts=getTimestamp(e.header);
    if (!ts) return;
    var d=new Date(ts.replace(/(\d{4}[-\/]\d{2}[-\/]\d{2})\s/,'$1T').replace(/\//g,'-'));
    if (isNaN(d.getTime())) return;
    var b=Math.floor(d.getTime()/3600000);
    buckets[b]=(buckets[b]||0)+1;
  });
  var keys=Object.keys(buckets).map(Number).sort(function(a,b){return a-b;});
  if (keys.length<2) return '';
  var vals=keys.map(function(k){return buckets[k];});
  var maxV=Math.max.apply(null,vals);
  var W=56,H=16,n=vals.length,bW=Math.max(2,Math.floor((W-n)/n)),gap=1;
  var bars=vals.map(function(v,i){
    var bh=Math.max(2,Math.round((v/maxV)*(H-2)));
    return '<rect x="'+(i*(bW+gap))+'" y="'+(H-bh)+'" width="'+bW+'" height="'+bh+'" rx="1" fill="'+color+'" opacity="0.55"/>';
  }).join('');
  return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+bars+'</svg>';
}

function highlightQ(text){
  if (!_filterQ) return esc(text);
  var parts=text.split(new RegExp('('+_filterQ.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'));
  return parts.map(function(p,i){ return i%2===1?'<mark class="search-hl">'+esc(p)+'</mark>':esc(p); }).join('');
}
function srCopy(idx){
  var text=_rawLines[idx];
  if (!text) return;
  navigator.clipboard.writeText(text).then(function(){
    var btn=document.querySelector('.sr-copy-btn[data-idx="'+idx+'"]');
    if (btn){ btn.textContent='✓'; btn.classList.add('copied'); setTimeout(function(){ btn.textContent='⎘'; btn.classList.remove('copied'); },1500); }
  });
}
function applyFilter(){
  var srBtn=document.querySelector('#tabBar .tab[data-tab="search-results"]');
  if (_filterQ){
    if (srBtn) srBtn.style.display='';
    switchTab('search-results');
    var r=_tabPermanentRenderers['search-results'];
    if (r) r('panel-search-results');
  } else {
    if (srBtn) srBtn.style.display='none';
    switchTab('issues');
  }
  var fe=filteredEntries();
  var el=document.getElementById('filterCount');
  if (el) el.textContent=_filterQ?(fe.length.toLocaleString()+' of '+_allEntries.length.toLocaleString()+' entries match'):'';
}

function renderCards(data, color, bgLight, bgDark, showCatTag){
  if (!data||data.total===0) return '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title" style="color:'+color+';">No entries found</div></div>';
  var html='<div style="font-size:12px;color:var(--dim);margin-bottom:14px;">'+data.total+' total &nbsp;·&nbsp; '+data.groups.length+' unique group(s) &nbsp;·&nbsp; click card to expand stack trace</div>';
  data.groups.forEach(function(g){
    var sid='st'+(++_sid), hasStack=g.stack&&g.stack.length>0;
    var meta=[];
    if (g.firstSeen) meta.push('⏱ '+g.firstSeen);
    if (g.count>1) meta.push('<span style="color:var(--warn);font-weight:600;">🔁 ×'+g.count+' occurrences</span>');
    if (g.lastSeen&&g.lastSeen!==g.firstSeen) meta.push('Last: '+g.lastSeen);
    if (g.source) meta.push('📍 '+esc(g.source));
    var catDef=g.category?ERROR_CATEGORIES.find(function(c){ return c.key===g.category; }):null;
    // Use CSS variable trick for dark/light bg
    var cardStyle='style="border-left:4px solid '+color+';background:'+bgLight+';"';
    // We'll use a data attribute so dark mode can be handled via CSS (inline bg is overridden)
    html+='<div class="log-card" data-lbg="'+bgLight+'" data-dbg="'+bgDark+'" style="border-left:4px solid '+color+';background:'+bgLight+';">';
    html+='<div class="log-card-head" style="background:'+bgLight+';" '+(hasStack?'onclick="toggleStack(\''+sid+'\')"':'')+' data-lbg="'+bgLight+'" data-dbg="'+bgDark+'">';
    html+='<div style="flex:1;min-width:0;">';
    if (showCatTag&&catDef) html+='<div class="log-card-category" style="color:'+catDef.color+';">'+esc(catDef.label)+'</div>';
    if (g.excType) html+='<div class="log-card-type" style="color:'+color+';">'+esc(g.excType)+'</div>';
    html+='<div class="log-card-msg">'+esc(g.msg)+'</div>';
    if (meta.length) html+='<div class="log-card-meta">'+meta.map(function(m){ return '<span>'+m+'</span>'; }).join('')+'</div>';
    html+='</div>';
    if (hasStack) html+='<div class="log-card-toggle" id="'+sid+'-arrow">▼ stack</div>';
    html+='</div>';
    if (hasStack) html+='<div class="stack-body" id="'+sid+'"><pre>'+renderStack(g.stack)+'</pre></div>';
    html+='</div>';
  });
  return html;
}
function toggleStack(id){
  var el=document.getElementById(id), arrow=document.getElementById(id+'-arrow');
  if (!el) return;
  var open=el.classList.toggle('open');
  if (arrow) arrow.textContent=open?'▲ stack':'▼ stack';
}

// Fix card backgrounds when dark mode toggles
document.getElementById('themeToggle').addEventListener('click', function(){
  var dark = document.body.classList.contains('dark');
  document.querySelectorAll('[data-lbg]').forEach(function(el){
    el.style.background = dark ? el.getAttribute('data-dbg') : el.getAttribute('data-lbg');
  });
});

// ═══════════════════════════════════════════════════════════
//  PII DETECTION
// ═══════════════════════════════════════════════════════════
var PII_RULES=[
  { type:'Email',     re:/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { type:'Public IP', re:/\b(?!10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  { type:'Private IP',re:/\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}|192\.168\.\d{1,3})\.\d{1,3}\b/g },
  { type:'JWT',       re:/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g },
  { type:'AWS Key',   re:/\b(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}\b/g },
  { type:'URL Creds', re:/https?:\/\/[^:@\s]+:[^@\s]+@[^\s"'<>]+/g },
  { type:'URL',          re:/(?:https?|file):\/\/(?!(?:[^:@\s]+:[^@\s]+@))[^\s"'<>\]\\,}{]+/g },
  { type:'Content URI',  re:/content:\/\/[^\s"'<>\]\\,}{]+/g },
  { type:'File Path',    re:/(?:[A-Za-z]:\\(?:[\w\s\-\.]+\\)*[\w\s\-\.]*|\/(?:home|users?|var|etc|tmp|usr|opt|private|System|Library|Applications)(?:\/[^\s"'<>\]\\,}{:*?|]+)+)/gi },
  { type:'UNC Path',     re:/\\\\[\w\-\.]+\\[\w\-\.\$]+(?:\\[^\s"'<>,*?|]+)*/g },
  { type:'Android Path', re:/\/(?:data\/(?:data|user\/\d+)|storage\/emulated\/\d+|sdcard)(?:\/[^\s"'<>\]\\,}{:*?|]+)+/gi },
  { type:'Phone Number', re:/\+\d[\d\s\-\.]{8,14}\d/g },
  { type:'SSN (US)',     re:/\b\d{3}-\d{2}-\d{4}\b/g },
];
var PII_FIELD_RULES = [
  { type:'Mail Address', re:/(?:\\)?"(?:FromAddress|ToAddress|CcAddress|BccAddress|SendingAddress)(?:\\)?"\s*:\s*(?:\\)?"((?:\\.|[^"])*)"(?!\s*:)/gi },
  { type:'Person Name',   re:/(?:\\)?"(?:SenderName|RecentMailSenderName|AccountOwnerDisplayName)(?:\\)?"\s*:\s*(?:\\)?"((?:\\.|[^"])*)"(?!\s*:)/gi },
  { type:'Bearer Token',  re:/\bBearer\s+([A-Za-z0-9\-_\.~\+\/]+=*)/gi },
  { type:'Phone Number',  re:/(?:phone|mobile|tel|cell|contact)\s*[:\=\s]+(\+?[\d\s\(\)\-\.]{7,15})/gi },
];
function pushPIIFinding(findings, seen, type, value, lineNo, ctx){
  var cleanValue = String(value || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  if (!cleanValue) return;
  var key = type + '|' + cleanValue;
  if (seen[key]) return;
  seen[key] = true;
  findings.push({
    type: type,
    value: cleanValue,
    line: lineNo,
    ctx: String(ctx || '').replace(/\\"/g, '"').trim().slice(0, 180)
  });
}
function isVersionLikeIpContext(line, startIdx, value){
  // Skip dotted numeric values when they are clearly version fields in JSON/log text.
  var windowStart = Math.max(0, startIdx - 80);
  var left = line.slice(windowStart, startIdx);
  if (/version/i.test(left)) return true;

  // Typical semver-ish value inside quotes: "1.38.6.0"
  var before = line[startIdx - 1] || '';
  var after = line[startIdx + value.length] || '';
  if ((before === '"' && after === '"') || (before === "'" && after === "'")) {
    return true;
  }
  return false;
}
function detectPII(lines){
  var findings=[],seen={};
  lines.forEach(function(line,idx){
    PII_RULES.forEach(function(rule){
      rule.re.lastIndex=0; var m;
      while ((m=rule.re.exec(line))!==null){
        if ((rule.type === 'Public IP' || rule.type === 'Private IP') && isVersionLikeIpContext(line, m.index, m[0])) continue;
        pushPIIFinding(findings, seen, rule.type, m[0], idx+1, line);
      }
    });
    PII_FIELD_RULES.forEach(function(rule){
      rule.re.lastIndex = 0;
      var m;
      while ((m = rule.re.exec(line)) !== null){
        pushPIIFinding(findings, seen, rule.type, m[1], idx+1, line);
      }
    });
  });
  return findings;
}

// ═══════════════════════════════════════════════════════════
//  SEND MAIL FLOW DETECTION
// ═══════════════════════════════════════════════════════════
var SEND_MAIL_HAPPY = [
  { step:1,  label:'Send Initiated',                        re:/SendMailDataManager\.SendMail:\d+\] START: SendMailDataManager:/ },
  { step:2,  label:'Draft ID Resolved (Local \u2192 Server)', re:/SendMailDataManager\.SendMail:\d+\] Updating mail with ServerDraftId in DB/ },
  { step:3,  label:'Attachments Fetched',                   re:/SendMailDataManager\.SendMail:\d+\] Attachments fetched from DB for DraftId:/ },
  { step:4,  label:'Send Transaction Started',              re:/SendMailDataManager\.Run:\d+\] START: SendMail Txn:/ },
  { step:5,  label:'Send Mode Identified',                  re:/SendMailDataManager\.SendMail:\d+\] SendMail - Mode:/ },
  { step:6,  label:'API Call Made',                         re:/MailNetHandler\.SendMail:\d+\] SendMail Action:/ },
  { step:7,  label:'Mail Moved to Sent',                    re:/SendMailDataManager\.MoveMailFromDraftsToSentInDB:\d+\] Moved mail \d+ from Drafts to Sent/, primary:true },
  { step:8,  label:'Send Transaction Ended',                re:/SendMailDataManager\.Run:\d+\] END: SendMail Txn:/ },
  { step:9,  label:'MailSent Notification Fired',           re:/MailDetailViewVM\.MailNotifications_MailSent:\d+\] MailSent:/ },
  { step:10, label:'Send Fully Completed',                  re:/SendMailDataManager\.SendMail:\d+\] END: SendMailDataManager:/ },
];

var SEND_MAIL_FAILURES = [
  { id:11, severity:'high',     label:'Ghost Mail \u2014 Stuck with No ChangeID',
    re:/MailActivityTracker\.RemoveOlderActivities:\d+\] ChangeID is 0 while removing older activities SendMail_\d+/,
    desc:'A SendMail activity was never acknowledged by the server (ChangeID\u00a0=\u00a00). The mail never actually sent.' },
  { id:13, severity:'critical', label:'Send Dependency Blocked',
    re:/ZTransactionManager\.PerformTransactionInternal:\d+\] Transaction [a-f0-9\-]+ has \d+ dependency transaction\(s\) yet to complete/,
    desc:'A send transaction is waiting on an earlier transaction that will never complete. The send is permanently blocked and will never reach the server.' },
  { id:14, severity:'high',     label:'Corrupt Transaction \u2014 Null JSON Payload',
    re:/InitMailActivityTrackerDataManager\.PopulatePendingMailActionsFromTransactions:\d+\] Error in adding transaction [a-f0-9\-]+ to mailactivity tracker/,
    desc:'A transaction was saved with a null/empty JSON payload and cannot be replayed on restart. Accumulates as dead weight in the activity tracker.' },
  { id:15, severity:'medium',   label:'Pending Stuck Transactions on Startup',
    re:/InitMailActivityTrackerDataManager\.PopulatePendingMailActionsFromTransactions:\d+\] Pending mail txns: ([1-9]\d*)/,
    desc:'Transactions from previous sessions found pending on startup. A high count indicates severe accumulation from prior crashes \u2014 most will fail on replay.' },
  { id:16, severity:'medium',   label:'Send API Network Timeout',
    re:/CallbackExtension\.OnCanceledOrTimeOutError:\d+\] Request timed out[\s\S]{0,120}(?:SendMail|GetMailListRequest)/,
    desc:'Send API request timed out. Mail may be in an indeterminate state \u2014 sent on the server but not confirmed locally.' },
  { id:17, severity:'low',      label:'UI Showed Draft State Instead of Sent',
    re:/Go to Response Panel State : DraftPanelWithSendNowState invoked/,
    desc:'Compose window closed but detail panel transitioned to DraftPanelWithSendNowState instead of SentPanelState. Cosmetic issue \u2014 send usually succeeds.' },
  { id:19, severity:'critical', label:'ZTransactionManager Null Type \u2014 Root Crash',
    re:/ZTransactionManager\.PerformTransactionInternal:\d+\] System\.ArgumentNullException: Value cannot be null/,
    desc:'Transaction controller registry returned null for a transaction type. Root cause of the dependency deadlock that blocks all sends.' },
];

function detectSendMailFlow(lines) {
  // Extract LocalDraftId from each Step-1 occurrence to define flow boundaries
  var localIdRe = /SendMailDataManager\.SendMail:\d+\] START: SendMailDataManager:\s*(Local_[\w\-]+)/;
  var starts = []; // { localId, idx }
  lines.forEach(function(line, idx) {
    var m = localIdRe.exec(line);
    if (m) starts.push({ localId: m[1], idx: idx });
  });

  var flows = [];

  if (starts.length > 0) {
    // One flow per Step-1; its lines run up to the next Step-1
    starts.forEach(function(start, fi) {
      var endIdx = fi + 1 < starts.length ? starts[fi + 1].idx : lines.length;
      var hp = SEND_MAIL_HAPPY.map(function(s) {
        return { step:s.step, label:s.label, primary:!!s.primary, matches:[] };
      });
      for (var li = start.idx; li < endIdx; li++) {
        var ln = lines[li];
        SEND_MAIL_HAPPY.forEach(function(s, i) {
          if (s.re.test(ln)) hp[i].matches.push({ line:ln.trim(), lineNum:li + 1 });
        });
      }
      flows.push({ flowNum:fi + 1, localId:start.localId, happyPath:hp,
                   flowComplete:hp[6].matches.length > 0 });
    });
  } else {
    // No Step-1 found — collect whatever steps are present as one unnamed flow
    var hp = SEND_MAIL_HAPPY.map(function(s) {
      return { step:s.step, label:s.label, primary:!!s.primary, matches:[] };
    });
    var anyStep = false;
    lines.forEach(function(ln, idx) {
      SEND_MAIL_HAPPY.forEach(function(s, i) {
        if (s.re.test(ln)) { hp[i].matches.push({ line:ln.trim(), lineNum:idx + 1 }); anyStep = true; }
      });
    });
    if (anyStep) flows.push({ flowNum:1, localId:null, happyPath:hp, flowComplete:hp[6].matches.length > 0 });
  }

  // Failures are collected globally (not per-flow)
  var failures = [];
  lines.forEach(function(ln, idx) {
    SEND_MAIL_FAILURES.forEach(function(f) {
      f.re.lastIndex = 0;
      if (f.re.test(ln)) failures.push({ id:f.id, label:f.label, severity:f.severity, desc:f.desc, line:ln.trim(), lineNum:idx + 1 });
    });
  });

  var doneCount = flows.filter(function(f){ return f.flowComplete; }).length;
  var hasAnyMatch = flows.length > 0 || failures.length > 0;
  return { flows:flows, failures:failures, hasAnyMatch:hasAnyMatch,
           sendCount:flows.length, doneCount:doneCount, flowComplete:doneCount > 0 };
}

function renderSendMailFlowTab(data) {
  var SEV_COLOR = { critical:'#dc2626', high:'#ea580c', medium:'#d97706', low:'#16a34a', info:'#2563eb' };
  var SEV_BG    = { critical:'#fef2f2', high:'#fff7ed', medium:'#fffbeb', low:'#f0fdf4', info:'#eff6ff' };
  var SEV_BG_D  = { critical:'#2d0a0a', high:'#1a0a00', medium:'#1a1000', low:'#001a0a', info:'#00102d' };
  var SEV_ORDER = ['critical','high','medium','low','info'];
  var FLOWS     = data.flows;

  var critHighCount = data.failures.filter(function(f){ return f.severity==='critical'||f.severity==='high'; }).length;

  // ── Overall status banner ──
  var bannerColor, bannerBg, bannerBgD, bannerIcon, bannerTitle, bannerDesc;
  if (data.flowComplete && critHighCount === 0) {
    bannerColor='#16a34a'; bannerBg='#f0fdf4'; bannerBgD='#001a0a';
    bannerIcon='&#10003;'; bannerTitle='Send Complete';
    bannerDesc = data.sendCount > 1
      ? data.doneCount+' of '+data.sendCount+' flows completed. No critical/high failures.'
      : 'Mail successfully moved from Drafts to Sent. No critical or high-severity failures.';
  } else if (!data.flowComplete && critHighCount > 0) {
    bannerColor='#dc2626'; bannerBg='#fef2f2'; bannerBgD='#2d0a0a';
    bannerIcon='&#10007;'; bannerTitle='Send Failed';
    bannerDesc = (data.sendCount > 1 ? data.doneCount+' of '+data.sendCount+' flows completed. ' : '')
      +critHighCount+' critical/high failure'+(critHighCount>1?'s':'')+' detected.';
  } else {
    bannerColor='#d97706'; bannerBg='#fffbeb'; bannerBgD='#1a1000';
    bannerIcon='&#9888;'; bannerTitle='Partial / Inconclusive';
    bannerDesc = data.sendCount > 1
      ? data.doneCount+' of '+data.sendCount+' flows reached step\u00a07.'
      : (data.flowComplete ? 'Send appears complete but failure indicators also present.' : 'Flow started but step\u00a07 not detected.');
  }

  // ── SVG flowchart for one flow ──
  function buildFlowSVG(happyPath, idSuffix) {
    var nW=300, nH=48, nR=7, gY=32, pX=14, pY=12;
    var svgW = nW + pX*2;
    var svgH = pY*2 + happyPath.length*nH + (happyPath.length-1)*gY;
    var midX = pX + nW/2;
    var markerId = 'sm-arr-'+idSuffix;
    var p = [];
    p.push('<svg width="'+svgW+'" height="'+svgH+'" viewBox="0 0 '+svgW+' '+svgH+'"'
      +' xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%;">');
    p.push('<defs><marker id="'+markerId+'" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">'
      +'<polygon points="0 0,7 2.5,0 5" style="fill:#9ca3af"/></marker></defs>');

    happyPath.forEach(function(s, i) {
      var found = s.matches.length > 0;
      var nx = pX, ny = pY + i*(nH+gY), cy = ny + nH/2;
      var sc = found ? (s.primary ? '#d97706' : '#16a34a') : '#6b7280';
      var sw = s.primary ? '2' : '1.5';

      if (i > 0) {
        var prevBtm = pY + (i-1)*(nH+gY) + nH;
        p.push('<line x1="'+midX+'" y1="'+prevBtm+'" x2="'+midX+'" y2="'+(ny-4)+'"'
          +' stroke="#9ca3af" stroke-width="1.5"'+(found ? '' : ' stroke-dasharray="5 3"')
          +' marker-end="url(#'+markerId+')"/>');
      }
      p.push('<rect x="'+nx+'" y="'+ny+'" width="'+nW+'" height="'+nH+'" rx="'+nR+'"'
        +' style="fill:var(--surface)" stroke="'+sc+'" stroke-width="'+sw+'"/>');
      p.push('<circle cx="'+(nx+22)+'" cy="'+cy+'" r="13" fill="'+sc+'"/>');
      p.push('<text x="'+(nx+22)+'" y="'+(cy+4.5)+'" text-anchor="middle"'
        +' font-size="11" font-weight="700" font-family="system-ui,sans-serif" fill="white">'+s.step+'</text>');

      var labelY = found ? cy-4 : cy+4;
      p.push('<text x="'+(nx+44)+'" y="'+labelY+'" font-size="11" font-weight="600"'
        +' font-family="system-ui,sans-serif" style="fill:'+(found?'var(--text)':'var(--muted)')+'">'+esc(s.label)+'</text>');

      if (found) {
        var sub = s.matches.length > 1
          ? '\u00d7'+s.matches.length+' \u2014 L'+s.matches[0].lineNum+'\u2026L'+s.matches[s.matches.length-1].lineNum
          : 'L'+s.matches[0].lineNum;
        p.push('<text x="'+(nx+44)+'" y="'+(cy+11)+'" font-size="10" font-family="monospace" style="fill:var(--muted)">'+sub+'</text>');
      } else {
        p.push('<text x="'+(nx+44)+'" y="'+(cy+11)+'" font-size="10" font-style="italic"'
          +' font-family="system-ui,sans-serif" style="fill:var(--muted)">not detected</text>');
      }
      if (s.primary) {
        var pillX = nx+nW-8, pillY = ny+nH-9;
        p.push('<rect x="'+(pillX-38)+'" y="'+(pillY-11)+'" width="38" height="13" rx="3" fill="#d97706"/>');
        p.push('<text x="'+(pillX-1)+'" y="'+pillY+'" text-anchor="end" font-size="8" font-weight="700"'
          +' font-family="system-ui,sans-serif" fill="white" letter-spacing=".06em">PRIMARY</text>');
      }
      var iconY = s.primary ? cy+3 : cy+5;
      p.push('<text x="'+(nx+nW-13)+'" y="'+iconY+'" text-anchor="middle" font-size="14" font-weight="700"'
        +' font-family="system-ui,sans-serif" fill="'+sc+'">'+(found?'\u2713':'\u2717')+'</text>');
    });
    p.push('</svg>');
    return p.join('');
  }

  // ── Collapsible log lines for one flow ──
  function buildStepLogs(happyPath) {
    var rows = happyPath.filter(function(s){ return s.matches.length > 0; });
    if (!rows.length) return '';
    var out = '';
    rows.forEach(function(s) {
      var sc = s.primary ? '#d97706' : '#16a34a';
      out += '<details style="margin-bottom:5px;border:1px solid var(--border);border-radius:6px;overflow:hidden;">'
        +'<summary style="cursor:pointer;padding:7px 12px;font-size:12px;font-weight:600;'
        +'display:flex;align-items:center;gap:8px;list-style:none;background:var(--surface);">'
        +'<span style="width:20px;height:20px;border-radius:50%;background:'+sc+';color:#fff;font-size:10px;'
        +'font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">'+s.step+'</span>'
        +esc(s.label)
        +'<span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--muted);">'
        +s.matches.length+' match'+(s.matches.length>1?'es':'')+'</span></summary>'
        +'<div>';
      s.matches.forEach(function(m) {
        out += '<div style="padding:5px 12px;border-top:1px solid var(--border);background:var(--stack-bg);">'
          +'<span style="font-size:10px;color:var(--muted);font-family:monospace;margin-right:8px;">L'+m.lineNum+'</span>'
          +'<span style="font-size:11px;font-family:monospace;color:var(--stack-text);'
          +'word-break:break-all;white-space:pre-wrap;">'+esc(m.line.slice(0,300))+'</span></div>';
      });
      out += '</div></details>';
    });
    return out;
  }

  var html = '<div style="padding:16px 20px;">';

  // ── Top banner ──
  html += '<div class="sm-banner" data-lbg="'+bannerBg+'" data-dbg="'+bannerBgD+'" style="'
    +'display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:8px;'
    +'border:1px solid '+bannerColor+'44;background:'+bannerBg+';margin-bottom:20px;">'
    +'<span style="font-size:22px;font-weight:700;color:'+bannerColor+';">'+bannerIcon+'</span>'
    +'<div>'
    +'<div style="font-size:15px;font-weight:700;color:'+bannerColor+';">'+bannerTitle
    +(data.sendCount > 1 ? ' <span style="font-size:12px;font-weight:500;opacity:.8;">('+data.sendCount+' flows)</span>' : '')+'</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-top:2px;">'+esc(bannerDesc)+'</div>'
    +'</div></div>';

  // ── Per-flow cards ──
  FLOWS.forEach(function(flow, fi) {
    var fc = flow.flowComplete ? '#16a34a' : '#dc2626';
    var fIcon = flow.flowComplete ? '&#10003;' : '&#10007;';
    var fLabel = flow.flowComplete ? 'Complete' : 'Incomplete';
    var stepsFound = flow.happyPath.filter(function(s){ return s.matches.length > 0; }).length;

    html += '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:16px;overflow:hidden;">';

    // Card header
    html += '<div style="padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);'
      +'display:flex;align-items:center;gap:10px;">'
      +'<span style="font-size:13px;font-weight:700;color:var(--text);">Flow '+(fi+1)+'</span>'
      +(flow.localId
        ? '<code style="font-size:11px;background:var(--stack-bg);color:var(--stack-text);'
          +'padding:2px 7px;border-radius:4px;">'+esc(flow.localId)+'</code>'
        : '')
      +'<span style="margin-left:auto;display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:'+fc+';">'
      +fIcon+' '+fLabel+'</span>'
      +'<span style="font-size:11px;color:var(--muted);">'+stepsFound+'/10 steps</span>'
      +'</div>';

    // Card body: chart left, logs right
    html += '<div style="display:flex;gap:0;align-items:flex-start;flex-wrap:wrap;">';

    // Left: SVG chart
    html += '<div style="padding:16px;flex-shrink:0;border-right:1px solid var(--border);">'
      + buildFlowSVG(flow.happyPath, fi)
      +'</div>';

    // Right: collapsible log lines
    html += '<div style="flex:1;min-width:260px;padding:12px 16px;">'
      +'<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;'
      +'color:var(--muted);margin-bottom:8px;">Matched Log Lines</div>'
      + (buildStepLogs(flow.happyPath) || '<div style="font-size:12px;color:var(--muted);padding:8px 0;">No steps detected.</div>')
      +'</div>';

    html += '</div></div>'; // end card body + card
  });

  // ── Failures (global) ──
  if (data.failures.length > 0) {
    html += '<div style="margin-top:4px;">'
      +'<div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;'
      +'color:var(--muted);margin-bottom:10px;">Failure Indicators ('+data.failures.length+')</div>';

    SEV_ORDER.forEach(function(sev) {
      var sevFailures = data.failures.filter(function(f){ return f.severity===sev; });
      if (!sevFailures.length) return;
      var col = SEV_COLOR[sev], bg = SEV_BG[sev], bgD = SEV_BG_D[sev];
      sevFailures.forEach(function(f) {
        html += '<div class="sm-failure-card" data-lbg="'+bg+'" data-dbg="'+bgD+'" style="'
          +'margin-bottom:8px;padding:12px 14px;border-radius:7px;border:1px solid '+col+'33;background:'+bg+';">'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
          +'<span style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;'
          +'padding:2px 7px;border-radius:4px;background:'+col+';color:#fff;">'+sev+'</span>'
          +'<span style="font-size:13px;font-weight:600;color:var(--text);">'+esc(f.label)+'</span>'
          +'<span style="margin-left:auto;font-size:11px;color:var(--muted);">L'+f.lineNum+'</span>'
          +'</div>'
          +'<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">'+esc(f.desc)+'</div>'
          +'<div style="font-size:11px;font-family:monospace;background:var(--stack-bg);color:var(--stack-text);'
          +'padding:7px 10px;border-radius:5px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;">'
          +esc(f.line.slice(0,300))+'</div>'
          +'</div>';
      });
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════
//  COMPONENT DESCRIPTION
// ═══════════════════════════════════════════════════════════
function describeClass(name){
  if (!name) return '';
  var words=name.replace(/([A-Z])/g,' $1').toLowerCase().split(/[\s._]+/).filter(Boolean);
  var map={ websocket:'WebSocket',socket:'Socket',connect:'connection',disconnect:'disconnection',
    receive:'receiving',send:'sending',download:'download',upload:'upload',transfer:'transfer',
    auth:'auth',login:'login',db:'database',sql:'database',query:'query',cache:'cache',
    image:'image',view:'UI view',manager:'manager',service:'service',mail:'mail',
    folder:'folder',list:'list',load:'loading',root:'root',shell:'shell',
    push:'push notification',notification:'notification',background:'background task',
    network:'network',http:'HTTP',file:'file',memory:'memory',api:'API' };
  var out=[];
  words.forEach(function(w){ if(map[w]&&out.indexOf(map[w])<0) out.push(map[w]); });
  if (!out.length) return 'Component';
  out[0]=out[0].charAt(0).toUpperCase()+out[0].slice(1);
  return out.join(' · ');
}

// ═══════════════════════════════════════════════════════════
//  BUILD DYNAMIC TABS
// ═══════════════════════════════════════════════════════════
// Tab render registry: lazy-render content on first activation
var _tabRenderRegistry = {};

function buildTabs(tabDefs){
  _tabRenderRegistry = {};
  _tabPermanentRenderers = {};
  var barHtml='', panelsHtml='';
  tabDefs.forEach(function(t,i){
    var active=i===0?' active':'';
    var badge=t.badge?'<span class="tbadge" style="background:'+t.bBg+';color:'+t.bColor+';">'+t.badge+'</span>':'';
    barHtml+='<button class="tab'+active+'" data-tab="'+t.id+'"'+(t._hidden?' style="display:none;"':'')+'>'+esc(t.label)+badge+'</button>';
    // All panels created empty; content injected on first click (lazy)
    panelsHtml+='<div id="panel-'+t.id+'" class="tab-content'+active+'"></div>';
    if (t._render) { _tabRenderRegistry[t.id]=t._render; _tabPermanentRenderers[t.id]=t._render; }
  });
  document.getElementById('tabBar').innerHTML=barHtml;
  document.getElementById('tabPanels').innerHTML=panelsHtml;

  document.querySelectorAll('#tabBar .tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      var name=btn.getAttribute('data-tab');
      // Update active tab button immediately (instant visual feedback)
      document.querySelectorAll('#tabBar .tab').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      // Defer the heavy DOM work to next frame so button highlight renders first
      requestAnimationFrame(function(){
        document.querySelectorAll('#tabPanels .tab-content').forEach(function(p){ p.classList.remove('active'); });
        var panel = document.getElementById('panel-'+name);
        panel.classList.add('active');
        // Lazy-render: only render content if not already rendered
        if (_tabRenderRegistry[name]) {
          _tabRenderRegistry[name]('panel-'+name);
          delete _tabRenderRegistry[name]; // rendered, don't repeat
        }
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  COLLAPSIBLE BLOCKS
// ═══════════════════════════════════════════════════════════
function toggleBlock(bodyId, btnId){
  var body = document.getElementById(bodyId);
  var btn  = typeof btnId === 'string' ? document.getElementById(btnId) : (btnId ? btnId.querySelector('.block-collapse-btn') : null);
  if (!body) return;
  var collapsed = body.classList.toggle('collapsed');
  if (btn) btn.textContent = collapsed ? '▼ Expand' : '▲ Collapse';
}

// ═══════════════════════════════════════════════════════════
//  ANALYZE
// ═══════════════════════════════════════════════════════════
document.getElementById('analyzeBtn').addEventListener('click', function(){
  var raw=document.getElementById('logInput').value;
  if (!raw.trim()) return;
  var nonEmpty=raw.split('\n').filter(function(l){ return l.trim(); });
  var counts={fatal:0,error:0,warn:0,info:0}, catCounts={}, genHits={};
  var firstTs=null, lastTs=null, byClass={};
  var entries=parseEntries(raw); _allEntries=entries; _rawLines=nonEmpty; _filterQ='';

  entries.forEach(function(e){
    var lv=e.level;
    if (lv!=='other'&&counts[lv]!==undefined) counts[lv]++;
    if (e.cat&&(lv==='fatal'||lv==='error'||lv==='warn'))
      catCounts[e.cat]=(catCounts[e.cat]||0)+1;
    var ts=getTimestamp(e.header);
    if (ts){ if(!firstTs) firstTs=ts; lastTs=ts; }
    Object.keys(GEN_PATTERNS).forEach(function(k){ if(GEN_PATTERNS[k].test(e.header)) genHits[k]=(genHits[k]||0)+1; });
    var cls=getClassName(getSource(e.header));
    if (cls){
      if (!byClass[cls]) byClass[cls]={error:0,warn:0,info:0,methods:{}};
      if (lv==='fatal'||lv==='error') byClass[cls].error++;
      else if (lv==='warn') byClass[cls].warn++;
      else if (lv==='info') byClass[cls].info++;
      var src=getSource(e.header); if(src) byClass[cls].methods[src]=true;
    }
  });

  var errTotal=counts.fatal+counts.error;
  var sev=errTotal>=10?'critical':errTotal>=4?'high':errTotal>=1||counts.warn>3?'medium':'low';
  var SEV_COLOR={critical:'#dc2626',high:'#ea580c',medium:'#d97706',low:'#16a34a'};
  var pii=detectPII(nonEmpty);
  var ids=extractIds(nonEmpty);
  var errRate = nonEmpty.length>0 ? ((counts.error+counts.fatal)/nonEmpty.length*100).toFixed(1) : 0;

  // Stats
  var STAT_DEFS = [
    { label:'Total Entries', val:nonEmpty.length, color:'#2563eb', bg:'rgba(37,99,235,.1)',
      svg:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'},
    { label:'Fatal Errors',  val:counts.fatal,    color:'#dc2626', bg:'rgba(220,38,38,.1)', tab:'lv-fatal',
      badge: counts.fatal===0 ? 'None' : '',
      sparkline: buildSparkline(entries,'fatal','#dc2626'),
      svg:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'},
    { label:'Errors',        val:counts.error,    color:'#e53e3e', bg:'rgba(229,62,62,.1)', tab:'lv-error',
      ring: buildProgressRing(errRate,'#e53e3e'),
      sparkline: buildSparkline(entries,'error','#e53e3e'),
      svg:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'},
    { label:'Warnings',      val:counts.warn,     color:'#d97706', bg:'rgba(217,119,6,.1)', tab:'lv-warn',
      sparkline: buildSparkline(entries,'warn','#d97706'),
      svg:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'},
    { label:'PII Found',     val:pii.length,      color:'#9333ea', bg:'rgba(147,51,234,.1)', tab:'pii',
      svg:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'},
  ];

  var statCardsHtml = STAT_DEFS.map(function(s){
    var extraStyle = s.tab ? 'cursor:pointer;' : '';
    var clickAttr  = s.tab ? ' onclick="switchTab(\''+s.tab+'\')"' : '';
    return '<div class="stat" style="'+extraStyle+'"'+clickAttr+'>'
      +'<div class="stat-top">'
      +'<div class="stat-icon-wrap" style="background:'+s.bg+';">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+s.svg+'</svg>'
      +'</div>'
      +(s.ring?s.ring:s.badge!==undefined?'<span class="stat-badge">'+s.badge+'</span>':'')
      +'</div>'
      +'<div class="stat-val" style="color:'+s.color+'">'+s.val.toLocaleString()+'</div>'
      +'<div class="stat-label">'+s.label+'</div>'
      +(s.sparkline?'<div class="stat-sparkline">'+s.sparkline+'</div>':'')
      +'</div>';
  }).join('');

  // Action buttons cell — same height as cards, stacked vertically
  var actionCellHtml = '<div class="stat-actions">'
    // +'<button id="aiTabBtn" class="stat-action-btn" style="background:linear-gradient(135deg,#1e1b4b,#3730a3);color:#fff;">'
    // +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    // +'AI Diagnosis</button>'
    +'<button id="shareTabBtn" class="stat-action-btn" style="background:linear-gradient(135deg,#0f4c4c,#0d9488);color:#fff;">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    +'Download / Share</button>'
    +'</div>';

  document.getElementById('statsBar').innerHTML = statCardsHtml + actionCellHtml;

  // Meta row: time range + severity + file info
  var metaParts=[];
  if (firstTs&&lastTs) metaParts.push('<span>🕐 <strong>'+esc(firstTs)+'</strong> → <strong>'+esc(lastTs)+'</strong></span>');

  metaParts.push('<span>⚡ Error rate: <strong>'+errRate+'%</strong></span>');
  metaParts.push('<span>Entries parsed: <strong>'+(entries.length).toLocaleString()+'</strong></span>');
  metaParts.push('<span>Severity: <span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:800;letter-spacing:.1em;background:'+SEV_COLOR[sev]+';color:#fff;">'+sev.toUpperCase()+'</span></span>');
  var sep='<span style="color:var(--border);font-size:18px;font-weight:200;margin:0 2px;user-select:none;">|</span>';
  document.getElementById('statsMetaContent').innerHTML=metaParts.join(sep);


  // ── Tab definitions — Issues is always first and default ──
  var tabDefs=[];

  tabDefs.push({id:'issues', label:'Issues'});

  var levelDefs=[
    {key:'fatal',label:'Fatal',  color:'#dc2626',lBg:'#fef2f2',dBg:'#2d0a0a',bBg:'#dc262622',bColor:'#dc2626'},
    {key:'error',label:'Error',  color:'#e53e3e',lBg:'#fff5f5',dBg:'#2d0a0a',bBg:'#e53e3e22',bColor:'#e53e3e'},
    {key:'warn', label:'Warn',   color:'#d97706',lBg:'#fffbeb',dBg:'#1a1000',bBg:'#d9770622',bColor:'#d97706'},
    {key:'info', label:'Info',   color:'#059669',lBg:'#f0fdf4',dBg:'#001a0a',bBg:'#05966922',bColor:'#059669'},
  ];
  levelDefs.forEach(function(ld){
    var data=groupBy(entries,function(e){ return e.level===ld.key; });
    if (data.total>0){
      (function(d,l){ tabDefs.push({id:'lv-'+l.key,label:l.label,badge:d.total,bBg:l.bBg,bColor:l.bColor,
        _render:function(pid){ document.getElementById(pid).innerHTML=renderCards(d,l.color,l.lBg,l.dBg,true); }
      }); })(data,ld);
    }
  });

  ERROR_CATEGORIES.forEach(function(cat){
    var data=groupBy(entries,function(e){ return e.cat===cat.key&&(e.level==='fatal'||e.level==='error'||e.level==='warn'); });
    if (data.total>0){
      (function(d,c){ tabDefs.push({id:'cat-'+c.key,label:c.label,badge:d.total,bBg:c.color+'22',bColor:c.color,
        _render:function(pid){ document.getElementById(pid).innerHTML=renderCards(d,c.color,c.bg,CAT_BG_DARK[c.key]||'#111',false); }
      }); })(data,cat);
    }
  });

  // Send Mail Flow tab
  var sendMailData = detectSendMailFlow(nonEmpty);
  if (sendMailData.hasAnyMatch) {
    var smCritHigh = sendMailData.failures.filter(function(f){ return f.severity==='critical'||f.severity==='high'; }).length;
    (function(d,ch){ tabDefs.push({
      id:'sendmail', label:'Send Mail Flow',
      badge: d.failures.length || d.sendCount || null,
      bBg:   ch > 0 ? '#ef444422' : '#22c55e22',
      bColor:ch > 0 ? '#ef4444'   : '#22c55e',
      _render: function(pid){ document.getElementById(pid).innerHTML = renderSendMailFlowTab(d); }
    }); })(sendMailData, smCritHigh);
  }

  // ZUID tab
  if (ids.zuids.length>0){
    tabDefs.push({id:'zuids',label:'ZUID',badge:ids.zuids.length,bBg:'#0ea5e922',bColor:'#0ea5e9'});
  }
  // AccId tab
  if (ids.accs.length>0){
    tabDefs.push({id:'accids',label:'Acc ID',badge:ids.accs.length,bBg:'#8b5cf622',bColor:'#8b5cf6'});
  }

  tabDefs.push({id:'recs',label:'Recommendations'});
  if (pii.length>0) tabDefs.push({id:'pii',label:'PII',badge:pii.length,bBg:'#9333ea22',bColor:'#9333ea'});

  // Feature tabs
  tabDefs.push({id:'timeline', label:'📊 Timeline'});

  // Search results tab (hidden until a keyword is typed)
  tabDefs.push({id:'search-results', label:'🔍 Search Results', _hidden:true,
    _render:function(pid){
      var q=_filterQ.toLowerCase();
      var matches=[];
      for (var i=0;i<_rawLines.length;i++){
        if (_rawLines[i].toLowerCase().indexOf(q)>=0){
          matches.push({line:_rawLines[i], lineNum:i+1});
        }
      }
      if (!matches.length){
        document.getElementById(pid).innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No lines match <strong>'+esc(_filterQ)+'</strong></div></div>';
        return;
      }
      var LV_COLOR={fatal:'#dc2626',error:'#e53e3e',warn:'#d97706',info:'#059669'};
      var lvCounts={fatal:0,error:0,warn:0,info:0};
      matches.forEach(function(m){ var lv=getLevel(m.line); if(lvCounts[lv]!==undefined) lvCounts[lv]++; });
      var html='<div class="sr-header">Found <strong>'+matches.length.toLocaleString()+'</strong> line'+(matches.length!==1?'s':'')+' matching <strong>'+esc(_filterQ)+'</strong></div>';
      html+='<div class="sr-breakdown">';
      ['fatal','error','warn','info'].forEach(function(lv){
        if (!lvCounts[lv]) return;
        html+='<span class="sr-bd-pill" style="color:'+LV_COLOR[lv]+';border-color:'+LV_COLOR[lv]+'22;background:'+LV_COLOR[lv]+'11;">'+lv.toUpperCase()+' <strong>'+lvCounts[lv].toLocaleString()+'</strong></span>';
      });
      html+='</div>';
      html+='<div class="sr-list">';
      matches.forEach(function(m){
        var lv=getLevel(m.line);
        var lc=LV_COLOR[lv]||'#6b7280';
        html+='<div class="sr-row">';
        html+='<span class="sr-lv" style="color:'+lc+';">'+lv.toUpperCase()+'</span>';
        html+='<span class="sr-ln">L'+m.lineNum+'</span>';
        html+='<span class="sr-text">'+highlightQ(m.line.trim())+'</span>';
        html+='<button class="sr-copy-btn" data-idx="'+(m.lineNum-1)+'" onclick="srCopy('+(m.lineNum-1)+')" title="Copy line">⎘</button>';
        html+='</div>';
      });
      html+='</div>';
      document.getElementById(pid).innerHTML=html;
    }
  });

  buildTabs(tabDefs);

  // ── Wire search bar ──
  var sb=document.getElementById('searchBar');
  if (sb) sb.style.display='';
  var fi=document.getElementById('filterInput');
  var fc=document.getElementById('filterClear');
  if (fi){
    fi.value='';
    fi.oninput=function(){ _filterQ=fi.value.trim(); if(fc) fc.style.display=_filterQ?'':'none'; applyFilter(); };
  }
  if(fc) fc.onclick=function(){ fi.value=''; _filterQ=''; fc.style.display='none'; applyFilter(); };
  document.querySelectorAll('.filter-level-btn').forEach(function(btn){
    btn.onclick=function(){ switchTab('lv-'+btn.getAttribute('data-level')); };
  });

  // Open Issues tab by default
  switchTab('issues');

  // Pre-render only the FIRST visible tab immediately.
  // All _render tabs (Error/Warn/etc) are lazy-rendered on first click via _tabRenderRegistry.
  // This avoids building thousands of DOM nodes upfront which caused the UI freeze.

  // ZUID panel
  if (ids.zuids.length>0)
    document.getElementById('panel-zuids').innerHTML = renderIdTable(ids.zuids,'ZUID','#0ea5e9');

  // AccId panel
  if (ids.accs.length>0)
    document.getElementById('panel-accids').innerHTML = renderIdTable(ids.accs,'Acc ID','#8b5cf6');

  // ── Rich Overview: card-based layout ──
  var svcList=Object.keys(byClass).sort(function(a,b){ return (byClass[b].error+byClass[b].warn)-(byClass[a].error+byClass[a].warn); });
  var topCls=svcList[0];

  // Health status
  var errTotal2=counts.fatal+counts.error;
  var healthIcon, healthColor, healthTitle, healthDesc;
  if (counts.fatal>0){
    healthIcon='🔥'; healthColor='var(--fatal)';
    healthTitle='Critical — Fatal errors detected';
    healthDesc=counts.fatal+' fatal error'+(counts.fatal>1?'s':'')+' occurred'+(counts.error?' along with '+counts.error+' additional error'+(counts.error>1?'s':''):'')+'. The application hit critical failures during this session.';
  } else if (counts.error>0){
    healthIcon='🔴'; healthColor='var(--error)';
    healthTitle='Degraded — Errors present';
    var rate=(errTotal2/nonEmpty.length*100).toFixed(1);
    healthDesc=counts.error+' error'+(counts.error>1?'s':'')+' logged'+(counts.warn?' with '+counts.warn+' warning'+(counts.warn>1?'s':''):'')+'. Error rate: '+rate+'% of all lines.';
  } else if (counts.warn>0){
    healthIcon='🟡'; healthColor='var(--warn)';
    healthTitle='Stable — Warnings only';
    healthDesc='No errors detected. '+counts.warn+' warning'+(counts.warn>1?'s':'')+' logged — system appears functional with some areas to watch.';
  } else {
    healthIcon='✅'; healthColor='var(--info)';
    healthTitle='Healthy — No issues found';
    healthDesc='No errors or warnings detected in this session. Log appears clean.';
  }

  // Time range card
  var timeDesc = (firstTs&&lastTs&&firstTs!==lastTs)
    ? firstTs+' → '+lastTs
    : (firstTs||'Unknown');

  // Top component
  var compTitle='', compDesc='';
  if (topCls&&(byClass[topCls].error+byClass[topCls].warn)>0){
    compTitle=topCls;
    compDesc=(byClass[topCls].error?byClass[topCls].error+' err ':'')+(byClass[topCls].warn?byClass[topCls].warn+' warn':'');
    if (svcList.length>1) compDesc+=' · '+(svcList.length-1)+' other component'+(svcList.length>2?'s':'')+' involved';
  }

  // Categories
  var catNames=Object.keys(catCounts).map(function(k){
    var cat=ERROR_CATEGORIES.find(function(x){return x.key===k;});
    return cat?cat.label:k;
  });

  // ── Build descriptive prose overview ──
  var prose = [];

  // P1: Scope
  var p1 = 'Analyzed <strong>'+nonEmpty.length.toLocaleString()+' log lines</strong>';
  if (firstTs&&lastTs&&firstTs!==lastTs) p1+=' spanning <strong>'+esc(firstTs)+'</strong> → <strong>'+esc(lastTs)+'</strong>';
  p1+=', producing <strong>'+entries.length.toLocaleString()+' parsed entries</strong>.';
  prose.push(p1);

  // P2: Health verdict
  var errTotal2=counts.fatal+counts.error;
  var p2='';
  if (counts.fatal>0){
    p2='The session hit <span class="ov-tag" style="background:#fef2f2;color:#dc2626;">'+counts.fatal+' fatal error'+(counts.fatal>1?'s':'')+'</span>'
      +(counts.error?' and <span class="ov-tag" style="background:#fff5f5;color:#e53e3e;">'+counts.error+' error'+(counts.error>1?'s':'')+'</span>':'')
      +' — the application experienced critical failures during this period.'
      +(counts.warn?' Additionally, <strong>'+counts.warn+' warning'+(counts.warn>1?'s were':' was')+'</strong> logged.':'');
  } else if (counts.error>0){
    var rate=(errTotal2/nonEmpty.length*100).toFixed(1);
    p2='<span class="ov-tag" style="background:#fff5f5;color:#e53e3e;">'+counts.error+' error'+(counts.error>1?'s':'')+'</span> detected'
      +(counts.warn?' alongside <span class="ov-tag" style="background:#fffbeb;color:#d97706;">'+counts.warn+' warning'+(counts.warn>1?'s':'')+'</span>':'')
      +'. Error rate is <strong>'+rate+'%</strong> of total lines'+(parseFloat(rate)<1?' — relatively low, but worth reviewing.':' — investigate promptly.');
  } else if (counts.warn>0){
    p2='No errors detected. <span class="ov-tag" style="background:#fffbeb;color:#d97706;">'+counts.warn+' warning'+(counts.warn>1?'s':'')+'</span> logged — system is mostly healthy with some areas to monitor.';
  } else {
    p2='<span class="ov-tag" style="background:#f0fdf4;color:#059669;">All clear</span> — no errors or warnings found. The log looks completely clean.';
  }
  prose.push(p2);

  // P3: Top component
  if (compTitle){
    var p3='<strong>'+esc(compTitle)+'</strong> was the most problematic component';
    if (byClass[compTitle]){
      p3+=' with '+(byClass[compTitle].error?'<strong style="color:var(--error);">'+byClass[compTitle].error+' error'+(byClass[compTitle].error>1?'s':'')+'</strong>':'')
        +(byClass[compTitle].error&&byClass[compTitle].warn?' and ':'')
        +(byClass[compTitle].warn?'<strong style="color:var(--warn);">'+byClass[compTitle].warn+' warning'+(byClass[compTitle].warn>1?'s':'')+'</strong>':'');
    }
    p3+='.';
    if (svcList.length>1) p3+=' <strong>'+(svcList.length-1)+'</strong> other component'+(svcList.length>2?'s were':' was')+' also active in this session.';
    prose.push(p3);
  }

  // P4: Categories
  if (catNames.length>0){
    prose.push('Error categories detected: <strong>'+catNames.map(esc).join('</strong>, <strong>')+'</strong>.');
  }

  // P5: Sensitive / IDs
  var sensItems=[];
  if (pii.length) sensItems.push('<span class="ov-tag" style="background:#faf5ff;color:#9333ea;">'+pii.length+' PII instance'+(pii.length>1?'s':'')+'</span>');
  if (ids.zuids.length) sensItems.push('<strong>'+ids.zuids.length+' ZUID'+(ids.zuids.length>1?'s':'')+'</strong>');
  if (ids.accs.length) sensItems.push('<strong>'+ids.accs.length+' Account ID'+(ids.accs.length>1?'s':'')+'</strong>');
  if (sensItems.length){
    prose.push(sensItems.join(' and ')+' found in plain text — ensure these are not exposed in external log pipelines or reports.');
  }

  // ── Pie chart: error categories breakdown ──
  var pieInnerHtml = '';
  var catKeys = Object.keys(catCounts);
  if (catKeys.length > 0) {
    var pieTotal = catKeys.reduce(function(s,k){ return s+catCounts[k]; }, 0);
    var PIE_COLORS = ['#dc2626','#d97706','#2563eb','#059669','#9333ea','#0891b2','#f97316','#6366f1','#ec4899','#10b981','#ef4444','#84cc16'];
    var cx=80, cy=80, outerR=72, innerR=38;
    var slicesSvg='', legendHtml='', startAngle=-Math.PI/2;
    catKeys.forEach(function(k,i){
      var cat=ERROR_CATEGORIES.find(function(x){ return x.key===k; });
      var name=cat?cat.label:k;
      var val=catCounts[k];
      var pct=(val/pieTotal*100).toFixed(1);
      var angle=(val/pieTotal)*2*Math.PI;
      var color=PIE_COLORS[i%PIE_COLORS.length];
      var x1=cx+outerR*Math.cos(startAngle), y1=cy+outerR*Math.sin(startAngle);
      var x2=cx+outerR*Math.cos(startAngle+angle), y2=cy+outerR*Math.sin(startAngle+angle);
      var xi1=cx+innerR*Math.cos(startAngle), yi1=cy+innerR*Math.sin(startAngle);
      var xi2=cx+innerR*Math.cos(startAngle+angle), yi2=cy+innerR*Math.sin(startAngle+angle);
      var large=angle>Math.PI?1:0;
      var tooltipTxt=name+': '+val+' ('+pct+'%)';
      slicesSvg+='<path d="M'+xi1+','+yi1+' L'+x1+','+y1+' A'+outerR+','+outerR+' 0 '+large+',1 '+x2+','+y2+' L'+xi2+','+yi2+' A'+innerR+','+innerR+' 0 '+large+',0 '+xi1+','+yi1+' Z"'
        +' fill="'+color+'" stroke="#fff" stroke-width="1.5"'
        +' style="transition:transform .15s,opacity .15s;transform-origin:80px 80px;cursor:pointer;"'
        +' onmouseenter="this.style.transform=\'scale(1.07)\';this.style.opacity=\'0.9\';document.getElementById(\'pie-tooltip\').textContent=\''+tooltipTxt.replace(/'/g,'&#39;')+'\';document.getElementById(\'pie-tooltip\').style.opacity=\'1\';"'
        +' onmouseleave="this.style.transform=\'scale(1)\';this.style.opacity=\'1\';document.getElementById(\'pie-tooltip\').style.opacity=\'0\';"'
        +' onclick="switchTab(\'cat-'+k+'\')"'
        +'/>';
      legendHtml+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;cursor:pointer;" onclick="switchTab(\'cat-'+k+'\')">'
        +'<div style="width:10px;height:10px;border-radius:2px;background:'+color+';flex-shrink:0;"></div>'
        +'<span style="font-size:12px;color:var(--fg);flex:1;">'+esc(name)+' — '+pct+'%</span>'
        +'<span style="font-size:12px;color:var(--dim);font-weight:600;">'+val+'</span>'
        +'</div>';
      startAngle+=angle;
    });
    pieInnerHtml='<div style="display:flex;align-items:center;gap:20px;flex-shrink:0;flex-wrap:wrap;">'
      +'<div style="position:relative;width:160px;height:160px;flex-shrink:0;">'
      +'<svg width="160" height="160" viewBox="0 0 160 160">'+slicesSvg+'</svg>'
      +'<div id="pie-tooltip" style="position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;font-size:11px;padding:3px 8px;border-radius:4px;white-space:nowrap;opacity:0;transition:opacity .15s;pointer-events:none;"></div>'
      +'</div>'
      +'<div style="flex:1;min-width:180px;">'
      +'<div style="font-size:11px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Error Categories</div>'
      +legendHtml
      +'</div>'
      +'</div>';
  }

  // Overview box wraps prose + pie chart side by side
  var summaryHtml='<div class="overview-box" style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">'
    +'<div style="flex:1;min-width:260px;">'+prose.map(function(p){return '<p>'+p+'</p>';}).join('')+'</div>'
    +(pieInnerHtml?pieInnerHtml:'')
    +'</div>';
  var pieHtml = '';

  var detCats=Object.keys(catCounts).map(function(k){ var c=ERROR_CATEGORIES.find(function(x){ return x.key===k; }); return c?c.label:k; });
  var genPats=Object.keys(genHits).map(function(k){ return k.charAt(0).toUpperCase()+k.slice(1); });
  var allPats=detCats.concat(genPats.filter(function(p){ return detCats.indexOf(p)<0; }));

  // Build components HTML (collapsible)
  var svcCardsHtml='';
  if (svcList.length>0){
    svcList.slice(0,20).forEach(function(cls){
      var cv=byClass[cls], methods=Object.keys(cv.methods);
      var mStr=methods.slice(0,3).join(', ')+(methods.length>3?' +'+(methods.length-3)+' more':'');
      var dom=cv.error>0?'var(--error)':cv.warn>0?'var(--warn)':'var(--info)';
      svcCardsHtml+='<div class="svc-card" style="border-left:3px solid '+dom+';">';
      svcCardsHtml+='<div><div style="font-size:13px;font-weight:600;color:var(--accent);">'+esc(cls)+'</div>';
      svcCardsHtml+='<div style="font-size:12px;color:var(--dim);margin-top:2px;">'+esc(describeClass(cls))+'</div>';
      if (mStr) svcCardsHtml+='<div style="font-size:11px;color:var(--muted);margin-top:4px;word-break:break-all;">'+esc(mStr)+'</div>';
      svcCardsHtml+='</div><div style="display:flex;gap:10px;flex-shrink:0;font-size:13px;">';
      if (cv.error) svcCardsHtml+='<span style="color:var(--error);font-weight:700;">'+cv.error+' err</span>';
      if (cv.warn)  svcCardsHtml+='<span style="color:var(--warn);font-weight:700;">'+cv.warn+' warn</span>';
      if (cv.info)  svcCardsHtml+='<span style="color:var(--dim);">'+cv.info+' info</span>';
      svcCardsHtml+='</div></div>';
    });
  }

  // Patterns HTML
  var patsHtml = allPats.length
    ? allPats.map(function(p){ return '<span class="ptag">'+esc(p)+'</span>'; }).join('')
    : '<span style="color:var(--dim);font-size:12px;">None detected</span>';

  // Two-column layout: components (left, collapsible) + patterns (right)
  var gridHtml = '<div class="summary-grid">'

    // ── Left: Components (collapsible) ──
    + '<div class="block">'
    +   '<div class="block-header">'
    +     '<span class="block-label">Components Detected (' + svcList.length + ')</span>'
    +     '<button class="block-collapse-btn" id="svc-toggle-btn" onclick="toggleBlock(\'svc-body\',\'svc-toggle-btn\')">▲ Collapse</button>'
    +   '</div>'
    +   '<div class="block-collapsible" id="svc-body">'
    +     (svcCardsHtml || '<span style="color:var(--dim);font-size:12px;">None detected</span>')
    +   '</div>'
    + '</div>'

    // ── Right: Detected Patterns ──
    + '<div class="block">'
    +   '<div class="block-header"><span class="block-label">Detected Patterns</span></div>'
    +   '<div class="patterns">' + patsHtml + '</div>'
    + '</div>'

  + '</div>';

  document.getElementById('summaryPanel').innerHTML=
    '<div class="block-label" style="margin-bottom:12px;">Overview</div>'
    + summaryHtml;

  // Issues
  var issues=[];
  if (counts.fatal>0) issues.push({color:'#dc2626',lv:'FATAL',tab:'lv-fatal',title:counts.fatal+' Fatal Error(s)',desc:'Fatal entries detected. Check the Fatal tab for stack traces.'});
  if (catCounts.runtime) issues.push({color:'#ef4444',lv:'ERROR',tab:'cat-runtime',title:'Runtime Exceptions',desc:catCounts.runtime+' runtime exception(s) found.'});
  if (catCounts.auth) issues.push({color:'#f97316',lv:'ERROR',tab:'cat-auth',title:'Auth & Authorization Failures',desc:catCounts.auth+' auth-related event(s): token expired, 401, 403, etc.'});
  if (catCounts.database) issues.push({color:'#3b82f6',lv:'ERROR',tab:'cat-database',title:'Database Errors',desc:catCounts.database+' DB error(s): deadlock, connection pool, SQL exceptions.'});
  if (catCounts.perf) issues.push({color:'#eab308',lv:'WARN',tab:'cat-perf',title:'Performance Issues',desc:catCounts.perf+' performance event(s): OOM, rate limiting, thread starvation.'});
  if (catCounts.fileio) issues.push({color:'#8b5cf6',lv:'ERROR',tab:'cat-fileio',title:'File / IO Errors',desc:catCounts.fileio+' file/IO error(s): not found, permission denied, disk full.'});
  if (catCounts.http) issues.push({color:'#10b981',lv:'ERROR',tab:'cat-http',title:'HTTP / API Errors',desc:catCounts.http+' HTTP error(s): 4xx/5xx status codes.'});
  if (catCounts.sqlite) issues.push({color:'#f59e0b',lv:'ERROR',tab:'cat-sqlite',title:'SQLite / DB Errors',desc:catCounts.sqlite+' SQLite error(s): incomplete input, error codes, query failures.'});
  if (catCounts.sync) issues.push({color:'#6366f1',lv:'ERROR',tab:'cat-sync',title:'Sync / Transaction Failures',desc:catCounts.sync+' sync failure(s): retries exhausted, draft/send/fetch errors.'});
  if (catCounts.network) issues.push({color:'#0ea5e9',lv:'ERROR',tab:'cat-network',title:'Network / Socket Errors',desc:catCounts.network+' network error(s): socket disconnects, WebSocket failures.'});
  if (catCounts.calendar) issues.push({color:'#ec4899',lv:'WARN',tab:'cat-calendar',title:'Calendar Parse Errors',desc:catCounts.calendar+' calendar parse error(s): invalid or unrecognised calendar types.'});
  if (catCounts.draft) issues.push({color:'#84cc16',lv:'WARN',tab:'cat-draft',title:'Draft / Compose Issues',desc:catCounts.draft+' draft/compose issue(s): nil summaries, missing thread mail, sync failures.'});
  if (catCounts.dbinit) issues.push({color:'#dc2626',lv:'FATAL',tab:'cat-dbinit',title:'DB Init / Connection Errors',desc:catCounts.dbinit+' DB init error(s): connection not initialized, read-only database.'});
  if (catCounts.oauth) issues.push({color:'#ea580c',lv:'ERROR',tab:'cat-oauth',title:'OAuth / Token Errors',desc:catCounts.oauth+' auth error(s): invalid access token, credential vault failures.'});
  if (catCounts.wssocket) issues.push({color:'#7c3aed',lv:'ERROR',tab:'cat-wssocket',title:'WebSocket Errors',desc:catCounts.wssocket+' WebSocket error(s): timeout, host not resolved, connection aborted.'});
  if (catCounts.filenotfound) issues.push({color:'#0891b2',lv:'ERROR',tab:'cat-filenotfound',title:'File / Resource Not Found',desc:catCounts.filenotfound+' resource error(s): missing files, profile pics, shared folder fetch failures.'});
  if (catCounts.nullref) issues.push({color:'#be185d',lv:'FATAL',tab:'cat-nullref',title:'Null Reference Errors',desc:catCounts.nullref+' null reference error(s): uninitialized objects on UI or data thread.'});
  if (catCounts.parsewin) issues.push({color:'#b45309',lv:'ERROR',tab:'cat-parsewin',title:'Parse / Format Errors',desc:catCounts.parsewin+' parse error(s): malformed notification content, stream data format issues.'});
  if (catCounts.appcrash)     issues.push({color:'#7a0000',lv:'FATAL',tab:'cat-appcrash',title:'App Crash (SIGABRT/EXC)',desc:catCounts.appcrash+' crash signal(s): application terminated via SIGABRT or exception. Crash log captured by KSCrash.'});
  if (catCounts.uitablecrash) issues.push({color:'#991b1b',lv:'FATAL',tab:'cat-uitablecrash',title:'UI Table / Outline Crash',desc:catCounts.uitablecrash+' UIKit table crash(es): NSOutlineView/NSTableView insertRowsAtIndexes caused NSInternalInconsistencyException during scroll.'});
  if (catCounts.kotlincrash)  issues.push({color:'#92400e',lv:'FATAL',tab:'cat-kotlincrash',title:'Kotlin / KMM Runtime Crash',desc:catCounts.kotlincrash+' KMM crash(es): TerminateHandler fired in ZohoCRMCore/SchemaSdk Kotlin runtime.'});
  if (catCounts.uithread)     issues.push({color:'#5b21b6',lv:'FATAL',tab:'cat-uithread',title:'Main Thread Violation',desc:catCounts.uithread+' main-thread crash(es): crash triggered on Thread 0 (com.apple.main-thread) during UI update.'});
  if (pii.length) issues.push({color:'#9333ea',lv:'WARN',tab:'pii',title:'PII / Sensitive Data',desc:pii.length+' sensitive data instance(s). See the PII tab.'});
  if (!issues.length) issues.push({color:'var(--info)',lv:'INFO',title:'No Major Issues Found',desc:'System looks healthy based on log content.'});

  document.getElementById('panel-issues').innerHTML=issues.map(function(iss){
    var click=iss.tab?' onclick="switchTab(\''+iss.tab+'\')" style="border-left:4px solid '+iss.color+';cursor:pointer;"':' style="border-left:4px solid '+iss.color+';"';
    return '<div class="issue"'+click+'><div class="issue-header"><span class="issue-level" style="color:'+iss.color+';">'+iss.lv+'</span><span class="issue-title">'+esc(iss.title)+'</span>'+(iss.tab?'<span class="issue-arrow">→</span>':'')+'</div><div class="issue-desc">'+esc(iss.desc)+'</div></div>';
  }).join('');

  // Recommendations
  var recs=[];
  if (pii.length) recs.push('Sensitive data found in logs. Implement log scrubbing or structured logging with field-level masking before storing or sharing.');
  if (catCounts.auth) recs.push('Auth failures detected. Audit token expiry policies, refresh token flow, and ensure credentials are rotated. Repeated 401/403 may indicate a security incident.');
  if (catCounts.database) recs.push('DB errors (deadlocks, pool exhaustion). Review connection pool limits, add retry logic with exponential backoff, check for long-running transactions.');
  if (catCounts.runtime) recs.push('Runtime exceptions (NullReference, InvalidOperation) indicate unhandled edge cases. Add null checks and defensive programming around flagged components.');
  if (catCounts.perf) recs.push('Performance issues (OOM, rate limits, thread starvation). Profile memory usage, implement circuit breakers, and review resource cleanup.');
  if (catCounts.fileio) recs.push('File/IO errors found. Verify file paths, check service account permissions, and handle missing file scenarios with fallback logic.');
  if (catCounts.http) recs.push('HTTP errors (4xx/5xx) detected. Review API configurations, add request validation, and implement retry logic for transient 5xx errors.');
  if (catCounts.sqlite) recs.push('SQLite errors detected (incomplete input, error codes). Validate SQL queries before execution and add WAL mode for concurrent access.');
  if (catCounts.sync) recs.push('Sync/transaction failures with retries exhausted. Review transaction retry policies and investigate root cause of persistent failures.');
  if (catCounts.network) recs.push('Network/socket disconnects detected. Implement reconnection logic with exponential backoff and monitor WebSocket health.');
  if (catCounts.calendar) recs.push('Calendar parse failures detected for unknown types (e.g. zpeople). Add handling for custom calendar types in ZCalCalendarParser.');
  if (catCounts.draft) recs.push('Draft/compose sync issues detected (nil conversation summary, missing thread). Investigate ZMailComposeSyncManager for race conditions.');
  if (catCounts.dbinit) recs.push('DB connection not initialized / read-only database. Ensure DB is fully initialized before any service accesses it; check file permissions on the SQLite database file.');
  if (catCounts.oauth) recs.push('OAuth token failures (invalid accessToken, credential vault errors). Trigger a token refresh flow on startup and verify PasswordVault permissions.');
  if (catCounts.wssocket) recs.push('WebSocket errors (timeout, HostNameNotResolved, ConnectionAborted). Implement exponential backoff reconnection; check DNS resolution and HRESULT 0x80072EE2/0x80072EFE/0x80072EFD.');
  if (catCounts.filenotfound) recs.push('File/resource not found errors (FileNotFoundException, ResourceNotFound). Verify asset packaging, inline image paths, and shared folder API responses.');
  if (catCounts.nullref) recs.push('Null reference exceptions on UI/data threads. Add null guards in GetSpamdata and DownloadInlineImage callbacks; check object lifecycle vs async completion timing.');
  if (catCounts.parsewin) recs.push('Parse/format errors in StreamsDataParser. Validate notification payload schema before parsing; add try-catch with fallback for malformed numeric fields.');
  if (catCounts.appcrash)     recs.push('App crash via SIGABRT/EXC detected. Review KSCrash report, check uncaught Objective-C/Swift exceptions and abort() call sites. Update crash symbolication.');
  if (catCounts.uitablecrash) recs.push('NSTableView/NSOutlineView crash: row insertion triggered an NSInternalInconsistencyException. Ensure data source updates are batched and performed on the main thread without re-entrant calls during scroll.');
  if (catCounts.kotlincrash)  recs.push('Kotlin Multiplatform (KMM) terminate handler fired in ZohoCRMCore/SchemaSdk. Investigate unhandled Kotlin exceptions or coroutine failures; check kotlinHandler and TerminateHandler call chain.');
  if (catCounts.uithread)     recs.push('Crash triggered on main thread (Thread 0) during scroll/bounds change. Avoid triggering data mutations from scroll notifications; use debouncing and ensure all UIKit operations are main-thread-safe.');
  if (counts.fatal>0) recs.push('Fatal errors present. Set up crash reporting and ensure graceful degradation so fatal errors do not leave users in a broken state.');
  if (errTotal>5) recs.push('High error rate. Set up centralized alerting (e.g., Grafana, PagerDuty) to trigger notifications automatically when thresholds are crossed.');
  if ((ids.zuids.length||ids.accs.length)) recs.push('ZUID and Account IDs are present in plain-text logs. Ensure these are not exposed in external log shipping or reporting pipelines.');
  if (!recs.length) recs.push('Logs look healthy. Consider adding structured JSON logging and distributed tracing for faster future analysis.');

  document.getElementById('panel-recs').innerHTML=recs.map(function(r,i){
    return '<div class="rec"><span class="rec-num">'+String(i+1).padStart(2,'0')+'</span><span class="rec-text">'+esc(r)+'</span></div>';
  }).join('');

  // PII
  if (pii.length>0){
    var piiByType={};
    pii.forEach(function(f){ piiByType[f.type]=(piiByType[f.type]||0)+1; });
    var chips=Object.keys(piiByType).map(function(t){
      return '<span style="border:1px solid #9333ea44;background:#9333ea11;color:#9333ea;font-size:12px;padding:4px 12px;border-radius:20px;">'+esc(t)+': '+piiByType[t]+'</span>';
    }).join('');
    var cards=pii.map(function(f){
      return '<div class="pii-card"><div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span class="pii-type">'+esc(f.type)+'</span><span style="font-size:11px;color:var(--muted);">line '+f.line+'</span></div>' +
        '<div class="pii-val">'+esc(f.value)+'</div><div class="pii-ctx">'+esc(f.ctx)+'</div></div>';
    }).join('');
    document.getElementById('panel-pii').innerHTML=
      '<div class="block"><div class="block-label" style="color:#9333ea;">⚠ '+pii.length+' sensitive data instance(s) found</div>' +
      '<div style="color:var(--dim);font-size:13px;margin-bottom:12px;">Redact before sharing or storing logs externally.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">'+chips+'</div></div>'+cards;
  }

  // Store report data for download
  _reportData = {
    total: nonEmpty.length,
    counts: counts,
    sev: sev,
    firstTs: firstTs,
    lastTs: lastTs,
    errRate: errRate,
    pii: pii.length,
    piiDetails: pii,
    issues: issues,
    recs: recs,
    components: svcList.slice(0,20).map(function(cls){
      return { name:cls, desc:describeClass(cls),
        error:byClass[cls].error, warn:byClass[cls].warn, info:byClass[cls].info };
    }),
    patterns: allPats,
    zuids: ids.zuids,
    accs: ids.accs,
    fileName: _uploadedFileName,
    entries: entries,
    catCounts: catCounts,
  };

  // ── Wire all new feature panels ──
  
  wireFeatureTabs(entries, _reportData);

    document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});

  document.getElementById('resetBtn').classList.remove('hidden');
});

// ═══════════════════════════════════════════════════════════
//  DOWNLOAD REPORT
// ═══════════════════════════════════════════════════════════
var _reportData = null; // populated after analyze

function downloadReport(){
  if (!_reportData) return;
  var d = _reportData;
  var lines = [];
  lines.push('LOG ANALYZER REPORT');
  lines.push('===================');
  lines.push('Generated: ' + new Date().toLocaleString());
  lines.push('');
  lines.push('SUMMARY');
  lines.push('-------');
  lines.push('Total Lines : ' + d.total.toLocaleString());
  lines.push('Fatal       : ' + d.counts.fatal);
  lines.push('Errors      : ' + d.counts.error);
  lines.push('Warnings    : ' + d.counts.warn);
  lines.push('Info        : ' + d.counts.info);
  lines.push('PII Found   : ' + d.pii);
  lines.push('Severity    : ' + d.sev.toUpperCase());
  if (d.firstTs) lines.push('Time Range  : ' + d.firstTs + ' → ' + d.lastTs);
  var errRate = d.total > 0 ? ((d.counts.fatal+d.counts.error)/d.total*100).toFixed(2) : 0;
  lines.push('Error Rate  : ' + errRate + '%');
  lines.push('');

  lines.push('ISSUES');
  lines.push('------');
  d.issues.forEach(function(iss){ lines.push('['+iss.lv+'] '+iss.title+' — '+iss.desc); });
  lines.push('');

  lines.push('RECOMMENDATIONS');
  lines.push('---------------');
  d.recs.forEach(function(r,i){ lines.push((i+1)+'. '+r); });
  lines.push('');

  if (d.components.length > 0){
    lines.push('COMPONENTS');
    lines.push('----------');
    d.components.forEach(function(comp){
      lines.push(comp.name + ' (' + comp.desc + ') — ' + comp.error + ' err, ' + comp.warn + ' warn, ' + comp.info + ' info');
    });
    lines.push('');
  }

  if (d.patterns.length > 0){
    lines.push('DETECTED PATTERNS');
    lines.push('-----------------');
    lines.push(d.patterns.join(', '));
    lines.push('');
  }

  if (d.zuids.length > 0){
    lines.push('ZUIDs FOUND');
    lines.push('-----------');
    d.zuids.forEach(function(z){ lines.push(z.value + ' (lines: ' + z.lines.slice(0,5).join(', ') + ')'); });
    lines.push('');
  }

  if (d.accs.length > 0){
    lines.push('ACCOUNT IDs FOUND');
    lines.push('-----------------');
    d.accs.forEach(function(a){ lines.push(a.value + ' (lines: ' + a.lines.slice(0,5).join(', ') + ')'); });
    lines.push('');
  }

  if (d.piiDetails.length > 0){
    lines.push('PII DETAILS');
    lines.push('-----------');
    d.piiDetails.forEach(function(f){ lines.push('['+f.type+'] '+f.value+' (line '+f.line+')'); });
    lines.push('');
  }

  var blob = new Blob([lines.join('\n')], {type:'text/plain'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'log-analysis-' + new Date().toISOString().slice(0,19).replace(/[T:]/g,'-') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}


// ═══════════════════════════════════════════════════════════
//  FEATURE: SWITCH TAB (helper used by toolbar buttons)
// ═══════════════════════════════════════════════════════════
function switchTab(id) {
  // Deactivate all tabs and panels
  document.querySelectorAll('#tabBar .tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('#tabPanels .tab-content').forEach(function(p){ p.classList.remove('active'); });
  // Activate target
  var btn   = document.querySelector('#tabBar .tab[data-tab="'+id+'"]');
  var panel = document.getElementById('panel-'+id);
  if (btn)   btn.classList.add('active');
  if (panel) {
    panel.classList.add('active');
    // Trigger lazy render if registered
    if (_tabRenderRegistry[id]) {
      _tabRenderRegistry[id]('panel-'+id);
      delete _tabRenderRegistry[id];
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  FEATURE: TIMELINE CHART
// ═══════════════════════════════════════════════════════════
function buildTimeline(entries) {
  var buckets = {}, order = [];
  entries.forEach(function(e) {
    var ts = getTimestamp(e.header);
    if (!ts) return;
    var bucket = ts.slice(0, 16);
    if (!buckets[bucket]) { buckets[bucket] = {fatal:0,error:0,warn:0,info:0}; order.push(bucket); }
    if (buckets[bucket][e.level] !== undefined) buckets[bucket][e.level]++;
  });
  if (order.length === 0) {
    return '<div style="padding:40px;text-align:center;color:var(--muted);">No timestamps found in log entries. Timestamps are required to build a timeline.</div>';
  }
  order.sort();
  var maxVal = 0;
  order.forEach(function(b) {
    var tot = buckets[b].fatal + buckets[b].error + buckets[b].warn + buckets[b].info;
    if (tot > maxVal) maxVal = tot;
  });
  if (maxVal === 0) maxVal = 1;

  var W=800, H=180, padL=40, padB=36, padT=12, padR=12;
  var chartW=W-padL-padR, chartH=H-padB-padT;
  var n=order.length, step=chartW/n, bw=Math.max(3,Math.min(28,Math.floor(step)-2));
  var bars='', xLabels='', yAxis='';
  var colors={fatal:'#dc2626',error:'#f97316',warn:'#d97706',info:'#059669'};
  var levels=['info','warn','error','fatal'];
  var labelStep=Math.max(1,Math.ceil(n/10));

  for (var t=0; t<=4; t++) {
    var val=Math.round(maxVal*t/4), ty=H-padB-Math.round(chartH*t/4);
    yAxis+='<line x1="'+padL+'" y1="'+ty+'" x2="'+(W-padR)+'" y2="'+ty+'" stroke="var(--border)" stroke-width="1"/>';
    yAxis+='<text x="'+(padL-4)+'" y="'+(ty+3)+'" text-anchor="end" font-size="9" fill="var(--dim)">'+val+'</text>';
  }

  order.forEach(function(b, i) {
    var x=padL+i*step+(step-bw)/2, yBase=H-padB, tot=0;
    levels.forEach(function(lv) {
      var count=buckets[b][lv];
      if (!count) return;
      var h=Math.max(2,Math.round((count/maxVal)*chartH)), y=yBase-tot-h;
      tot+=h;
      bars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw+'" height="'+h+'" fill="'+colors[lv]+'" opacity="0.85" rx="1"><title>'+b+'\n'+lv+': '+count+'</title></rect>';
    });
    if (i%labelStep===0 || i===n-1) {
      var lx=padL+i*step+step/2, label=b.slice(11,16)||b.slice(0,10);
      xLabels+='<text x="'+lx.toFixed(1)+'" y="'+(H-padB+15)+'" text-anchor="middle" font-size="9" fill="var(--dim)">'+label+'</text>';
    }
  });

  return '<div style="padding:16px 20px;">'
    +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;max-width:'+W+'px;display:block;" xmlns="http://www.w3.org/2000/svg">'+yAxis+bars+xLabels+'</svg>'
    +'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--dim);">'
    +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#dc2626;display:inline-block;"></span>Fatal</span>'
    +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#f97316;display:inline-block;"></span>Error</span>'
    +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#d97706;display:inline-block;"></span>Warning</span>'
    +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#059669;display:inline-block;"></span>Info</span>'
    +'<span style="margin-left:auto;">'+n+' time buckets · hover for details</span>'
    +'</div></div>';
}

// ═══════════════════════════════════════════════════════════
//  FEATURE: REGEX SEARCH
// ═══════════════════════════════════════════════════════════
var _searchEntries = [];
var _searchInited  = false;

function initSearch(entries) {
  _searchEntries = entries;
  if (_searchInited) return; // don't double-bind listeners
  _searchInited = true;

  var inp      = document.getElementById('searchInput');
  var countEl  = document.getElementById('searchCount');
  var chipCase = document.getElementById('chip-case');
  var chipRegex= document.getElementById('chip-regex');
  var chipErr  = document.getElementById('chip-errors');
  var clearBtn = document.getElementById('clearSearch');

  function getPanel() { return document.getElementById('panel-search'); }

  function runSearch() {
    var panel = getPanel();
    if (!panel) return;
    var q = inp.value.trim();
    if (!q) {
      countEl.textContent = '';
      panel.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">Type to search — plain text or regex.</div>';
      return;
    }
    var useRegex = chipRegex.classList.contains('active');
    var caseSens = chipCase.classList.contains('active');
    var errOnly  = chipErr.classList.contains('active');
    inp.classList.remove('invalid');
    var re;
    try {
      var pattern = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      var flags   = caseSens ? 'g' : 'gi';
      re = new RegExp(pattern, flags);
    } catch(e) {
      inp.classList.add('invalid');
      countEl.textContent = 'Invalid regex';
      return;
    }
    var source = errOnly
      ? _searchEntries.filter(function(e){ return e.level==='fatal'||e.level==='error'||e.level==='warn'; })
      : _searchEntries;
    var hits = [];
    source.forEach(function(e, i) {
      var text = e.lines.join(' ');
      re.lastIndex = 0;
      if (re.test(text)) hits.push({e:e, text:text, idx:i+1});
    });
    countEl.textContent = hits.length + ' match' + (hits.length!==1?'es':'');
    if (hits.length === 0) {
      panel.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">No matches. Try different terms or toggle filters.</div>';
      return;
    }
    var html = '<div style="max-height:520px;overflow-y:auto;">';
    hits.slice(0,200).forEach(function(h) {
      var lvColor = h.e.level==='fatal'?'var(--fatal)':h.e.level==='error'?'var(--error)':h.e.level==='warn'?'var(--warn)':'var(--info)';
      re.lastIndex = 0;
      var preview = esc(h.text.slice(0,300)).replace(
        new RegExp(re.source, re.flags.replace('g','')+'g'),
        function(m){ return '<mark>'+m+'</mark>'; }
      );
      html += '<div style="padding:8px 14px;border-bottom:1px solid var(--border);font-size:12px;font-family:monospace;line-height:1.6;word-break:break-all;">'
        +'<span style="font-size:10px;color:var(--muted);margin-right:6px;">#'+h.idx+'</span>'
        +'<span style="font-size:10px;font-weight:700;color:'+lvColor+';margin-right:8px;text-transform:uppercase;">'+h.e.level+'</span>'
        +preview+'</div>';
    });
    if (hits.length>200) html += '<div style="padding:10px 14px;font-size:12px;color:var(--muted);">Showing first 200 of '+hits.length+' matches.</div>';
    html += '</div>';
    panel.innerHTML = html;
  }

  inp.addEventListener('input', runSearch);
  chipCase.addEventListener('click',  function(){ chipCase.classList.toggle('active');  runSearch(); });
  chipRegex.addEventListener('click', function(){ chipRegex.classList.toggle('active'); runSearch(); });
  chipErr.addEventListener('click',   function(){ chipErr.classList.toggle('active');   runSearch(); });
  clearBtn.addEventListener('click',  function(){ inp.value=''; countEl.textContent=''; runSearch(); });

}

// ═══════════════════════════════════════════════════════════
//  FEATURE: COMPARE TWO LOGS
// ═══════════════════════════════════════════════════════════
function renderComparePanel(panelId) {
  var panel = document.getElementById(panelId);
  panel.innerHTML = [
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;">',
    '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">',
    '<div style="padding:9px 14px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:12px;font-weight:700;display:flex;justify-content:space-between;">',
    '<span>Log A</span><span id="cmp-badge-a" style="font-size:11px;color:var(--muted);font-weight:400;"></span></div>',
    '<textarea id="cmp-a" style="width:100%;min-height:140px;background:transparent;border:none;outline:none;color:var(--text);font-family:inherit;font-size:12px;padding:12px;resize:vertical;" placeholder="Paste first log here…"></textarea>',
    '</div>',
    '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">',
    '<div style="padding:9px 14px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:12px;font-weight:700;display:flex;justify-content:space-between;">',
    '<span>Log B</span><span id="cmp-badge-b" style="font-size:11px;color:var(--muted);font-weight:400;"></span></div>',
    '<textarea id="cmp-b" style="width:100%;min-height:140px;background:transparent;border:none;outline:none;color:var(--text);font-family:inherit;font-size:12px;padding:12px;resize:vertical;" placeholder="Paste second log here…"></textarea>',
    '</div>',
    '</div>',
    '<div style="padding:0 16px 16px;">',
    '<button id="runCompareBtn" style="font-family:inherit;font-size:13px;font-weight:700;padding:9px 24px;border-radius:8px;background:var(--accent);color:var(--surface);border:none;cursor:pointer;width:100%;">Compare →</button>',
    '</div>',
    '<div id="cmp-result" style="padding:0 16px 16px;"></div>'
  ].join('');

  function countStats(raw) {
    var lines = raw.split('\n').filter(function(l){ return l.trim(); });
    var counts = {fatal:0,error:0,warn:0,info:0};
    lines.forEach(function(l){ var lv=getLevel(l); if(counts[lv]!==undefined) counts[lv]++; });
    return {total:lines.length, counts:counts};
  }

  document.getElementById('cmp-a').addEventListener('input', function(){
    document.getElementById('cmp-badge-a').textContent = this.value.split('\n').filter(function(l){return l.trim();}).length + ' lines';
  });
  document.getElementById('cmp-b').addEventListener('input', function(){
    document.getElementById('cmp-badge-b').textContent = this.value.split('\n').filter(function(l){return l.trim();}).length + ' lines';
  });

  document.getElementById('runCompareBtn').addEventListener('click', function() {
    var rawA = document.getElementById('cmp-a').value;
    var rawB = document.getElementById('cmp-b').value;
    var out  = document.getElementById('cmp-result');
    if (!rawA.trim() || !rawB.trim()) { out.innerHTML = '<p style="color:var(--error);font-size:13px;">Paste logs in both columns first.</p>'; return; }
    var sA = countStats(rawA), sB = countStats(rawB);

    function row(label, color, vA, vB, higherIsBad) {
      var delta = vB - vA;
      var arrow = delta>0 ? '▲ +'+delta : delta<0 ? '▼ '+delta : '– no change';
      var dColor = delta===0 ? 'var(--muted)' : (higherIsBad ? (delta>0?'var(--error)':'var(--info)') : (delta>0?'var(--info)':'var(--error)'));
      return '<tr>'
        +'<td style="padding:9px 14px;font-weight:600;color:'+color+';border-bottom:1px solid var(--border);">'+label+'</td>'
        +'<td style="padding:9px 14px;font-size:18px;font-weight:800;color:'+color+';border-bottom:1px solid var(--border);">'+vA.toLocaleString()+'</td>'
        +'<td style="padding:9px 14px;font-size:18px;font-weight:800;color:'+color+';border-bottom:1px solid var(--border);">'+vB.toLocaleString()+'</td>'
        +'<td style="padding:9px 14px;font-weight:700;color:'+dColor+';border-bottom:1px solid var(--border);">'+arrow+'</td>'
        +'</tr>';
    }
    out.innerHTML = '<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:13px;">'
      +'<thead><tr style="background:var(--surface2);">'
      +'<th style="padding:9px 14px;text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:700;border-bottom:1px solid var(--border);">Metric</th>'
      +'<th style="padding:9px 14px;text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:700;border-bottom:1px solid var(--border);">Log A</th>'
      +'<th style="padding:9px 14px;text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:700;border-bottom:1px solid var(--border);">Log B</th>'
      +'<th style="padding:9px 14px;text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:700;border-bottom:1px solid var(--border);">Delta</th>'
      +'</tr></thead><tbody>'
      + row('Total Lines', 'var(--text)', sA.total, sB.total, true)
      + row('Fatal',    'var(--fatal)', sA.counts.fatal, sB.counts.fatal, true)
      + row('Errors',   'var(--error)', sA.counts.error, sB.counts.error, true)
      + row('Warnings', 'var(--warn)',  sA.counts.warn,  sB.counts.warn,  true)
      + row('Info',     'var(--info)',  sA.counts.info,  sB.counts.info,  false)
      +'</tbody></table>';
  });
}

// ═══════════════════════════════════════════════════════════
//  FEATURE: AI DIAGNOSIS (commented out)
// ═══════════════════════════════════════════════════════════
function renderAIPanel(panelId, reportData) {
  return; // AI DIAGNOSIS DISABLED

  // ── Provider + model catalogue ──
  var PROVIDERS = {
    anthropic: {
      label: '🟣 Anthropic (Claude)',
      placeholder: 'sk-ant-api03-…',
      keyLink: 'https://console.anthropic.com/settings/keys',
      models: [
        { id:'claude-haiku-4-5-20251001',    label:'Claude Haiku  — fastest · ~$0.02' },
        { id:'claude-sonnet-4-20250514', label:'Claude Sonnet — best balance · ~$0.15 ★' },
        { id:'claude-opus-4-20250514',   label:'Claude Opus   — most powerful · ~$0.75' }
      ],
      defaultModel: 'claude-sonnet-4-20250514'
    },
    openai: {
      label: '🟢 OpenAI (GPT)',
      placeholder: 'sk-…',
      keyLink: 'https://platform.openai.com/api-keys',
      models: [
        { id:'gpt-4o-mini', label:'GPT-4o mini — fastest · ~$0.01' },
        { id:'gpt-4o',      label:'GPT-4o      — best balance · ~$0.20 ★' },
        { id:'gpt-4-turbo', label:'GPT-4 Turbo — most powerful · ~$0.40' }
      ],
      defaultModel: 'gpt-4o'
    },
    google: {
      label: '🔵 Google (Gemini)',
      placeholder: 'AIza…',
      keyLink: 'https://aistudio.google.com/app/apikey',
      models: [
        { id:'gemini-1.5-flash', label:'Gemini 1.5 Flash — fastest · ~$0.001' },
        { id:'gemini-1.5-pro',   label:'Gemini 1.5 Pro   — best balance · ~$0.04 ★' },
        { id:'gemini-2.0-flash', label:'Gemini 2.0 Flash — latest · ~$0.002' }
      ],
      defaultModel: 'gemini-1.5-pro'
    },
    cohere: {
      label: '🟠 Cohere (Command)',
      placeholder: '…',
      keyLink: 'https://dashboard.cohere.com/api-keys',
      models: [
        { id:'command-r-plus', label:'Command R+ — most capable · ~$0.03 ★' },
        { id:'command-r',      label:'Command R  — balanced · ~$0.005' },
        { id:'command-light',  label:'Command Light — fastest · ~$0.001' }
      ],
      defaultModel: 'command-r-plus'
    }
  };

  var S = 'font-family:inherit;font-size:12px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);outline:none;cursor:pointer;';

  var providerOpts = Object.keys(PROVIDERS).map(function(k){
    return '<option value="'+k+'">'+PROVIDERS[k].label+'</option>';
  }).join('');

  var panel = document.getElementById(panelId);
  panel.innerHTML = [
    /* ── Dark indigo hero card ── */
    '<div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#3730a3 100%);',
    'border-radius:12px;padding:22px 24px;margin:16px;position:relative;overflow:hidden;">',

    /* decorative circuit lines */
    '<div style="position:absolute;right:0;top:0;bottom:0;width:110px;opacity:.13;pointer-events:none;display:flex;align-items:center;">',
    '<svg viewBox="0 0 110 150" fill="none" style="width:100%;height:100%;">',
    '<path d="M55 5 L55 45 L85 45 L85 75 L105 75" stroke="white" stroke-width="1.5" stroke-linecap="round"/>',
    '<path d="M55 45 L25 45 L25 95 L55 95 L55 145" stroke="white" stroke-width="1.5" stroke-linecap="round"/>',
    '<path d="M85 75 L85 115 L55 115" stroke="white" stroke-width="1.5" stroke-linecap="round"/>',
    '<circle cx="55" cy="45" r="3.5" fill="white"/><circle cx="85" cy="75" r="3.5" fill="white"/>',
    '<circle cx="55" cy="115" r="3.5" fill="white"/><circle cx="55" cy="95" r="3.5" fill="white"/>',
    '</svg></div>',

    /* title row */
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">',
    '<div style="width:30px;height:30px;background:rgba(255,255,255,.18);border-radius:7px;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;">',
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    '</svg></div>',
    '<span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:-.01em;">AI Diagnosis</span>',
    '</div>',

    /* description */
    '<p style="color:rgba(255,255,255,.72);font-size:12.5px;line-height:1.6;margin-bottom:18px;max-width:320px;">',
    'Get a professional root-cause analysis and security assessment powered by AI. Only the log summary is sent — never raw data.',
    '</p>',

    /* CTA button */
    '<button id="ai-run-btn" style="font-family:inherit;font-size:13px;font-weight:700;padding:10px 22px;',
    'background:#ffffff;color:#312e81;border:none;border-radius:8px;cursor:pointer;',
    'display:inline-flex;align-items:center;gap:7px;transition:opacity .15s;box-shadow:0 2px 8px rgba(0,0,0,.18);">',
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
    '<polygon points="5 3 19 12 5 21 5 3"/></svg>',
    'Run AI Diagnosis</button>',
    '</div>',

    /* ── Settings section ── */
    '<div style="padding:0 16px 16px;">',

    /* Provider + model */
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;margin-top:14px;">',
    '<div><label style="font-size:10px;font-weight:700;color:var(--dim);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.07em;">Provider</label>',
    '<select id="ai-provider-sel" style="'+S+'width:100%;">'+providerOpts+'</select></div>',
    '<div><label style="font-size:10px;font-weight:700;color:var(--dim);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.07em;">Model</label>',
    '<select id="ai-model-sel" style="'+S+'width:100%;"></select></div>',
    '</div>',

    /* API key */
    '<div style="margin-bottom:6px;">',
    '<label style="font-size:10px;font-weight:700;color:var(--dim);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.07em;">API Key</label>',
    '<input id="ai-key-inp" type="password" placeholder="Paste your API key here…" autocomplete="off"',
    ' style="width:100%;'+S+'padding:8px 12px;"/>',
    '</div>',

    /* get key link */
    '<p style="font-size:11px;color:var(--muted);margin-bottom:14px;">',
    'No key yet? <a id="ai-key-link" href="#" target="_blank" ',
    'style="color:var(--accent);text-decoration:none;font-weight:600;">Get one here →</a></p>',

    /* output */
    '<div id="ai-out" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;',
    'padding:16px;font-size:13px;line-height:1.85;color:var(--muted);min-height:80px;white-space:pre-wrap;">',
    'Your AI diagnosis will appear here after clicking Run AI Diagnosis above.',
    '</div>',
    '</div>'
  ].join('');

  // ── Populate model dropdown when provider changes ──
  function updateModels() {
    var pKey  = document.getElementById('ai-provider-sel').value;
    var prov  = PROVIDERS[pKey];
    var sel   = document.getElementById('ai-model-sel');
    sel.innerHTML = prov.models.map(function(m){
      return '<option value="'+m.id+'"'+(m.id===prov.defaultModel?' selected':'')+'>'+m.label+'</option>';
    }).join('');
    document.getElementById('ai-key-inp').placeholder = prov.placeholder;
    document.getElementById('ai-key-link').href = prov.keyLink;
  }
  updateModels();
  document.getElementById('ai-provider-sel').addEventListener('change', updateModels);

  // ── Call correct API based on provider ──
  document.getElementById('ai-run-btn').addEventListener('click', function() {
    var key      = document.getElementById('ai-key-inp').value.trim();
    var pKey     = document.getElementById('ai-provider-sel').value;
    var model    = document.getElementById('ai-model-sel').value;
    var out      = document.getElementById('ai-out');
    var btn      = document.getElementById('ai-run-btn');
    var provName = PROVIDERS[pKey].label;

    if (!key) { out.style.color='var(--error)'; out.textContent='Please enter your API key.'; return; }

    btn.disabled=true; btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Analyzing…';
    out.style.color='var(--muted)';
    out.textContent='Sending log summary to '+provName.replace(/[🟣🟢🔵🟠]\s*/,'')+'…';

    var d = reportData;
    var prompt = 'You are a senior software engineer. Analyze this log summary and write a plain-English diagnosis:\n\n'
      +'Total lines: '+d.total+'\nFatal: '+d.counts.fatal+', Errors: '+d.counts.error
      +', Warnings: '+d.counts.warn+', Info: '+d.counts.info
      +'\nSeverity: '+d.sev+(d.firstTs?'\nTime: '+d.firstTs+' → '+d.lastTs:'')
      +'\nError rate: '+(d.total>0?((d.counts.fatal+d.counts.error)/d.total*100).toFixed(2):0)+'%'
      +'\nIssues: '+d.issues.map(function(i){ return '['+i.lv+'] '+i.title; }).join('; ')
      +'\nComponents: '+d.components.filter(function(c){ return c.error>0; }).slice(0,8).map(function(c){ return c.name+'('+c.error+' err)'; }).join(', ')
      +'\nPatterns: '+d.patterns.join(', ')
      +'\n\nWrite 3–5 paragraphs of flowing prose (no bullet lists): what happened, the likely root cause, what the errors mean in practical terms, and the top 3 concrete actions an engineer should take right now.';

    var btnResetHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run AI Diagnosis';
    function done(text) {
      btn.disabled=false; btn.innerHTML=btnResetHTML;
      out.style.color='var(--text)'; out.textContent=text;
    }
    function fail(msg) {
      btn.disabled=false; btn.innerHTML=btnResetHTML;
      out.style.color='var(--error)'; out.textContent=msg;
    }

    // ── Anthropic ──
    if (pKey === 'anthropic') {
      fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,
                 'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:model,max_tokens:1024,messages:[{role:'user',content:prompt}]})
      })
      .then(function(r){return r.json();})
      .then(function(data){
        if (data.error) { fail('Anthropic error: '+data.error.message); return; }
        done((data.content&&data.content[0]&&data.content[0].text)||'No response.');
      })
      .catch(function(e){ fail('Request failed: '+e.message); });

    // ── OpenAI ──
    } else if (pKey === 'openai') {
      fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model:model,max_tokens:1024,messages:[{role:'user',content:prompt}]})
      })
      .then(function(r){return r.json();})
      .then(function(data){
        if (data.error) { fail('OpenAI error: '+data.error.message); return; }
        done((data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content)||'No response.');
      })
      .catch(function(e){ fail('Request failed: '+e.message); });

    // ── Google Gemini ──
    } else if (pKey === 'google') {
      // Note: Gemini API supports browser CORS with API key in URL
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+key;
      fetch(url, {
        method:'POST',
        mode:'cors',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1024}})
      })
      .then(function(r){
        if (!r.ok) return r.json().then(function(e){ throw new Error((e.error&&e.error.message)||('HTTP '+r.status)); });
        return r.json();
      })
      .then(function(data){
        if (data.error) { fail('Google error: '+data.error.message); return; }
        var text = data.candidates&&data.candidates[0]&&data.candidates[0].content
          &&data.candidates[0].content.parts&&data.candidates[0].content.parts[0]&&data.candidates[0].content.parts[0].text;
        if (!text && data.candidates&&data.candidates[0]&&data.candidates[0].finishReason) {
          fail('Google blocked the request (finishReason: '+data.candidates[0].finishReason+'). Try a different model or check your API key permissions.'); return;
        }
        done(text||'No response.');
      })
      .catch(function(e){
        var msg = e.message||'';
        if (msg.toLowerCase().indexOf('fetch')!==-1||msg.toLowerCase().indexOf('cors')!==-1||msg.toLowerCase().indexOf('network')!==-1) {
          fail('Connection failed. This is usually a CORS or network issue when calling Google directly from the browser.\n\nTry:\n1. Make sure your API key has the Generative Language API enabled in Google Cloud Console\n2. Check that your key has no IP/referrer restrictions\n3. Try a different browser or disable browser extensions\n\nOriginal error: '+msg);
        } else {
          fail('Request failed: '+msg);
        }
      });

    // ── Cohere ──
    } else if (pKey === 'cohere') {
      fetch('https://api.cohere.com/v2/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,
                 'X-Client-Name':'log-analyzer'},
        body:JSON.stringify({model:model,messages:[{role:'user',content:prompt}],max_tokens:1024})
      })
      .then(function(r){return r.json();})
      .then(function(data){
        if (data.message) { fail('Cohere error: '+data.message); return; }
        var text = data.message&&data.message.content&&data.message.content[0]&&data.message.content[0].text;
        done(text||'No response.');
      })
      .catch(function(e){
        var msg = e.message||'';
        if (msg.toLowerCase().indexOf('fetch')!==-1||msg.toLowerCase().indexOf('cors')!==-1) {
          fail('Connection failed. Cohere may block direct browser requests due to CORS.\nCheck that your API key is valid and try again.\nError: '+msg);
        } else { fail('Request failed: '+msg); }
      });
    }
  });
}


// ═══════════════════════════════════════════════════════════
//  FEATURE: SHARE REPORT
// ═══════════════════════════════════════════════════════════
function renderSharePanel(panelId, reportData) {
  var d = reportData;
  var panel = document.getElementById(panelId);
  var errRate = d.total>0?((d.counts.fatal+d.counts.error)/d.total*100).toFixed(2):0;
  var SEV_COLORS = {critical:'#dc2626',high:'#ea580c',medium:'#d97706',low:'#16a34a'};
  var sevColor = SEV_COLORS[d.sev]||'#6b7280';


  // ── Build preview HTML ──
  var totalErrors = d.counts.fatal + d.counts.error;
  var S  = 'font-family:inherit;font-size:12px;font-weight:700;padding:8px 18px;border-radius:7px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:opacity .15s;';

  // Stat mini-cards
  var statCards = [
    {label:'Total Lines', val:d.total.toLocaleString(),          color:'#2563eb'},
    {label:'Fatal',       val:d.counts.fatal,                    color:'#991b1b'},
    {label:'Errors',      val:d.counts.error,                    color:'#dc2626'},
    {label:'Warnings',    val:d.counts.warn,                     color:'#d97706'},
    {label:'Info',        val:d.counts.info,                     color:'#059669'},
    {label:'PII Found',   val:d.pii,                             color:'#9333ea'},
  ].map(function(s){
    return '<div style="flex:1;min-width:70px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 8px;text-align:center;">'
      +'<div style="font-size:20px;font-weight:900;color:'+s.color+';line-height:1;">'+s.val+'</div>'
      +'<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-top:3px;font-weight:700;">'+s.label+'</div>'
      +'</div>';
  }).join('');

  // Issues rows
  var issueRows = d.issues.slice(0,12).map(function(i){
    var lvBg = i.lv==='FATAL'?'#991b1b': i.lv==='ERROR'?'#dc2626': i.lv==='WARN'?'#d97706':'#059669';
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">'
      +'<span style="flex-shrink:0;font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:'+lvBg+';color:#fff;letter-spacing:.07em;margin-top:2px;">'+i.lv+'</span>'
      +'<div style="min-width:0;">'
      +'<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px;">'+esc(i.title)+'</div>'
      +'<div style="font-size:11px;color:var(--dim);line-height:1.5;">'+esc(i.desc)+'</div>'
      +'</div></div>';
  }).join('');

  // Top components table
  var topComps = d.components.filter(function(c){ return c.error>0||c.warn>0; }).slice(0,8);
  var compRows = topComps.map(function(comp){
    var errorPct = d.total>0 ? Math.round(comp.error/d.total*100) : 0;
    return '<tr>'
      +'<td style="padding:6px 10px;font-size:11px;font-weight:600;color:var(--text);">'+esc(comp.name)+'</td>'
      +'<td style="padding:6px 10px;font-size:11px;font-weight:700;color:#dc2626;text-align:center;">'+comp.error+'</td>'
      +'<td style="padding:6px 10px;font-size:11px;font-weight:700;color:#d97706;text-align:center;">'+comp.warn+'</td>'
      +'<td style="padding:6px 10px;font-size:11px;color:var(--dim);text-align:center;">'+errorPct+'%</td>'
      +'<td style="padding:6px 10px;">'
      +'<div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;">'
      +'<div style="background:#dc2626;height:100%;width:'+Math.min(100,errorPct*3)+'%;"></div>'
      +'</div></td>'
      +'</tr>';
  }).join('');

  // Detected patterns chips
  var patChips = (d.patterns||[]).slice(0,12).map(function(p){
    return '<span style="display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);color:var(--dim);margin:2px;">'+esc(p)+'</span>';
  }).join('');

  // Recommendations
  var recRows = d.recs.slice(0,6).map(function(r,i){
    return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start;">'
      +'<span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</span>'
      +'<div style="font-size:11px;color:var(--text);line-height:1.6;">'+esc(r)+'</div>'
      +'</div>';
  }).join('');

  // ── Shared helpers ──
  var piiTypeColors={'Email':'#2563eb','Mail Address':'#7c3aed','Person Name':'#0891b2','Public IP':'#dc2626','Private IP':'#d97706','Phone Number':'#059669','SSN (US)':'#991b1b'};
  function lvColor(lv){ return lv==='fatal'?'#991b1b':lv==='error'?'#dc2626':lv==='warn'?'#d97706':lv==='info'?'#059669':'#6b7280'; }
  function lvBg2(lv){ return lv==='fatal'?'rgba(153,27,27,.06)':lv==='error'?'rgba(220,38,38,.06)':lv==='warn'?'rgba(217,119,6,.06)':lv==='info'?'rgba(5,150,105,.06)':'var(--surface2)'; }

  function buildPreviewEntryCards(entries) {
    if (!entries||!entries.length) return '<div style="padding:16px;color:var(--muted);font-size:12px;">No entries.</div>';
    return entries.map(function(e){
      var col=lvColor(e.level), bg=lvBg2(e.level);
      var stkLines=(e.stack&&e.stack.length?e.stack:(e.body&&e.body.length>1?e.body.slice(1):[]));
      var stk=stkLines.length?'<div style="margin-top:5px;padding:5px 7px;background:var(--surface2);border-radius:4px;font-size:10px;color:var(--dim);white-space:pre-wrap;word-break:break-all;">'+esc(stkLines.join('\n'))+'</div>':'';
      return '<div style="border-left:3px solid '+col+';background:'+bg+';border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:6px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">'
        +'<span style="font-size:9px;font-weight:800;color:'+col+';letter-spacing:.08em;text-transform:uppercase;">'+esc(e.level)+'</span>'
        +(e.line?'<span style="font-size:10px;color:var(--muted);">line '+e.line+'</span>':'')
        +'</div>'
        +(e.header?'<div style="font-size:10px;color:var(--dim);margin-bottom:2px;word-break:break-all;">'+esc(e.header.trim().slice(0,120))+'</div>':'')
        +(e.msg?'<div style="font-size:12px;color:var(--text);word-break:break-all;">'+esc(e.msg.trim())+'</div>':'')
        +stk+'</div>';
    }).join('');
  }

  function buildPreviewIdTable(items, label, color) {
    if (!items||!items.length) return '<div style="padding:16px;color:var(--muted);">None found.</div>';
    return '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      +'<thead><tr style="background:var(--surface2);">'
      +'<th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--dim);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border);">'+label+'</th>'
      +'<th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--dim);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border);">Lines</th>'
      +'<th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--dim);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border);">First Context</th>'
      +'</tr></thead><tbody>'
      +items.map(function(item){
        return '<tr><td style="padding:6px 10px;font-weight:700;color:'+color+';border-bottom:1px solid var(--border);">'+esc(item.value)+'</td>'
          +'<td style="padding:6px 10px;color:var(--dim);border-bottom:1px solid var(--border);">'+item.lines.slice(0,5).join(', ')+(item.lines.length>5?' …':'')+'</td>'
          +'<td style="padding:6px 10px;font-size:10px;color:var(--muted);word-break:break-all;border-bottom:1px solid var(--border);">'+esc((item.contexts&&item.contexts[0])||'')+'</td>'
          +'</tr>';
      }).join('')+'</tbody></table>';
  }

  // ── Build tab definitions ──
  var previewTabs=[];
  previewTabs.push({id:'sp-summary',label:'Summary',badge:''});
  var spLevelTabs=[{key:'fatal',label:'Fatal',color:'#991b1b'},{key:'error',label:'Error',color:'#dc2626'},{key:'warn',label:'Warn',color:'#d97706'},{key:'info',label:'Info',color:'#059669'}];
  spLevelTabs.forEach(function(lt){ if(d.counts[lt.key]>0) previewTabs.push({id:'sp-lv-'+lt.key,label:lt.label,badge:d.counts[lt.key],bc:lt.color}); });
  var spCatInfo=[
    {key:'runtime',label:'Runtime Exceptions',color:'#ef4444'},{key:'auth',label:'Auth & Authorization',color:'#f97316'},
    {key:'database',label:'Database Errors',color:'#3b82f6'},{key:'perf',label:'Performance Issues',color:'#eab308'},
    {key:'fileio',label:'File / IO Errors',color:'#8b5cf6'},{key:'http',label:'API / HTTP Errors',color:'#10b981'},
    {key:'sqlite',label:'SQLite / DB Errors',color:'#f59e0b'},{key:'sync',label:'Sync Failures',color:'#6366f1'},
    {key:'network',label:'Network / Socket Errors',color:'#0ea5e9'},{key:'calendar',label:'Calendar Parse Errors',color:'#ec4899'},
    {key:'draft',label:'Draft / Compose Issues',color:'#84cc16'},{key:'dbinit',label:'DB Init Errors',color:'#dc2626'},
    {key:'oauth',label:'OAuth / Token Errors',color:'#ea580c'},{key:'wssocket',label:'WebSocket Errors',color:'#7c3aed'},
    {key:'filenotfound',label:'File / Resource Not Found',color:'#0891b2'},{key:'nullref',label:'Null Reference Errors',color:'#be185d'},
    {key:'parsewin',label:'Parse / Format Errors',color:'#b45309'},{key:'appcrash',label:'App Crash',color:'#7a0000'},
    {key:'uitablecrash',label:'UI Table Crash',color:'#991b1b'},{key:'kotlincrash',label:'Kotlin / KMM Crash',color:'#6d1a75'},
    {key:'uithread',label:'Main Thread Violation',color:'#5b21b6'},
  ];
  spCatInfo.forEach(function(ci){ if(d.catCounts&&d.catCounts[ci.key]>0) previewTabs.push({id:'sp-cat-'+ci.key,label:ci.label,badge:d.catCounts[ci.key],bc:ci.color,_cat:ci.key}); });
  if(d.zuids&&d.zuids.length) previewTabs.push({id:'sp-zuids',label:'Zuid',badge:d.zuids.length,bc:'#0ea5e9'});
  if(d.accs&&d.accs.length) previewTabs.push({id:'sp-accids',label:'Acc ID',badge:d.accs.length,bc:'#8b5cf6'});
  previewTabs.push({id:'sp-issues',label:'Issues',badge:''});
  previewTabs.push({id:'sp-recs',label:'Recommendations',badge:''});
  if(d.piiDetails&&d.piiDetails.length) previewTabs.push({id:'sp-pii',label:'PII',badge:d.piiDetails.length,bc:'#9333ea'});

  // ── Build tab bar ──
  var spTabBarHtml = previewTabs.map(function(t,i){
    var badge=t.badge?'<span style="display:inline-block;font-size:9px;font-weight:800;padding:1px 5px;border-radius:10px;background:'+(t.bc||'#e5e7eb')+'22;color:'+(t.bc||'#6b7280')+';margin-left:3px;border:1px solid '+(t.bc||'#e5e7eb')+'44;">'+t.badge+'</span>':'';
    return '<button class="sp-tab-btn" data-spid="'+t.id+'" style="font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;border:none;border-bottom:2px solid '+(i===0?'var(--accent)':'transparent')+';background:none;padding:7px 11px;color:'+(i===0?'var(--accent)':'var(--dim)')+';white-space:nowrap;">'+esc(t.label)+badge+'</button>';
  }).join('');

  // ── Build panel content ──
  var spPanelContents={};

  // Summary
  spPanelContents['sp-summary']='<div style="padding:14px;">'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">'+statCards+'</div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">'
    +'<div style="font-size:11px;color:var(--dim);font-weight:600;white-space:nowrap;">Error Rate</div>'
    +'<div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden;"><div style="background:'+sevColor+';height:100%;width:'+Math.min(100,parseFloat(errRate))+'%;border-radius:4px;"></div></div>'
    +'<div style="font-size:13px;font-weight:900;color:'+sevColor+';white-space:nowrap;">'+errRate+'%</div>'
    +'<div style="font-size:11px;color:var(--muted);white-space:nowrap;">'+totalErrors+' / '+d.total.toLocaleString()+' lines</div>'
    +'</div>'
    +(topComps.length?'<div style="font-size:10px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Top Components by Errors</div>'
    +'<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:12px;margin-bottom:14px;">'
    +'<thead><tr style="background:var(--surface2);"><th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--dim);font-weight:700;text-transform:uppercase;">Component</th>'
    +'<th style="padding:6px 10px;text-align:center;font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;">Errors</th>'
    +'<th style="padding:6px 10px;text-align:center;font-size:10px;color:#d97706;font-weight:700;text-transform:uppercase;">Warns</th>'
    +'<th style="padding:6px 10px;text-align:center;font-size:10px;color:var(--dim);font-weight:700;text-transform:uppercase;">% of Log</th>'
    +'</tr></thead><tbody>'+compRows+'</tbody></table>':'')
    +'</div>';

  spLevelTabs.forEach(function(lt){
    if(d.counts[lt.key]>0){
      var ents=d.entries.filter(function(e){ return e.level===lt.key; });
      spPanelContents['sp-lv-'+lt.key]='<div style="padding:14px;">'+buildPreviewEntryCards(ents)+'</div>';
    }
  });

  spCatInfo.forEach(function(ci){
    if(d.catCounts&&d.catCounts[ci.key]>0){
      var ents=d.entries.filter(function(e){ return e.cat===ci.key&&(e.level==='fatal'||e.level==='error'||e.level==='warn'); });
      spPanelContents['sp-cat-'+ci.key]='<div style="padding:14px;">'+buildPreviewEntryCards(ents)+'</div>';
    }
  });

  if(d.zuids&&d.zuids.length) spPanelContents['sp-zuids']='<div style="padding:14px;">'+buildPreviewIdTable(d.zuids,'ZUID','#0ea5e9')+'</div>';
  if(d.accs&&d.accs.length) spPanelContents['sp-accids']='<div style="padding:14px;">'+buildPreviewIdTable(d.accs,'Acc ID','#8b5cf6')+'</div>';

  spPanelContents['sp-issues']='<div style="padding:14px;">'+(d.issues.length?d.issues.map(function(i){
    var bg=i.lv==='FATAL'?'#991b1b':i.lv==='ERROR'?'#dc2626':i.lv==='WARN'?'#d97706':'#059669';
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">'
      +'<span style="flex-shrink:0;font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:'+bg+';color:#fff;letter-spacing:.07em;margin-top:2px;">'+i.lv+'</span>'
      +'<div><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px;">'+esc(i.title)+'</div>'
      +'<div style="font-size:11px;color:var(--dim);">'+esc(i.desc)+'</div></div></div>';
  }).join(''):'<div style="color:var(--muted);font-size:12px;">No issues detected.</div>')+'</div>';

  spPanelContents['sp-recs']='<div style="padding:14px;">'+(d.recs.length?d.recs.map(function(r,i){
    return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start;">'
      +'<span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</span>'
      +'<div style="font-size:11px;color:var(--text);line-height:1.6;">'+esc(r)+'</div></div>';
  }).join(''):'<div style="color:var(--muted);font-size:12px;">No recommendations.</div>')+'</div>';

  if(d.piiDetails&&d.piiDetails.length){
    var piiByType2={};
    d.piiDetails.forEach(function(f){ piiByType2[f.type]=(piiByType2[f.type]||0)+1; });
    var pChips=Object.keys(piiByType2).map(function(t){
      return '<span style="display:inline-block;border:1px solid #9333ea44;background:#9333ea11;color:#9333ea;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;margin:2px;">'+esc(t)+': '+piiByType2[t]+'</span>';
    }).join('');
    var pCards=d.piiDetails.map(function(f){
      var col=piiTypeColors[f.type]||'#9333ea';
      return '<div style="border:1px solid var(--border);border-left:3px solid '+col+';border-radius:0 6px 6px 0;padding:10px 12px;margin-bottom:8px;background:var(--surface);">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
        +'<span style="font-size:9px;font-weight:800;color:'+col+';letter-spacing:.1em;text-transform:uppercase;">'+esc(f.type)+'</span>'
        +'<span style="font-size:10px;color:var(--muted);">line '+f.line+'</span></div>'
        +'<div style="font-size:13px;font-weight:700;color:'+col+';margin-bottom:4px;word-break:break-all;">'+esc(f.value)+'</div>'
        +'<div style="font-size:11px;color:var(--dim);word-break:break-all;background:var(--surface2);border-radius:4px;padding:5px 8px;margin-top:4px;">'+esc(f.ctx)+'</div>'
        +'</div>';
    }).join('');
    spPanelContents['sp-pii']='<div style="padding:14px;">'
      +'<div style="font-size:12px;color:var(--dim);margin-bottom:10px;">Redact before sharing or storing logs externally.</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">'+pChips+'</div>'
      +pCards+'</div>';
  }

  // ── Assemble panels HTML ──
  var spPanelsHtml = previewTabs.map(function(t,i){
    return '<div class="sp-panel" data-spid="'+t.id+'" style="display:'+(i===0?'block':'none')+';">'+(spPanelContents[t.id]||'<div style="padding:16px;color:var(--muted);">No data.</div>')+'</div>';
  }).join('');

  panel.innerHTML = '<div style="padding:0 20px 20px;">'

    // ── Header bar ──
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 12px;border-bottom:1px solid var(--border);margin-bottom:0;">'
    +'<div>'
    +'<div style="font-size:13px;font-weight:800;color:var(--text);">Log Analysis Report</div>'
    +'<div style="font-size:10px;color:var(--muted);margin-top:2px;">'+(d.fileName?'<span style="font-weight:700;color:var(--text);">'+esc(d.fileName)+'</span> &nbsp;·&nbsp; ':'')+' Generated '+new Date().toLocaleString()+(d.firstTs?' &nbsp;·&nbsp; '+esc(d.firstTs)+' → '+esc(d.lastTs):'')+'</div>'
    +'</div>'
    +'<span style="font-size:11px;font-weight:800;padding:4px 14px;border-radius:6px;background:'+sevColor+';color:#fff;letter-spacing:.1em;">'+d.sev.toUpperCase()+'</span>'
    +'</div>'

    // ── Tab bar ──
    +'<div style="display:flex;flex-wrap:wrap;border-bottom:1px solid var(--border);margin-bottom:0;gap:0;padding:0;">'+spTabBarHtml+'</div>'

    // ── Tab panels ──
    +'<div style="background:var(--surface);border:1px solid var(--border);border-top:none;">'+spPanelsHtml+'</div>'

    // ── Buttons ──
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:14px;">'
    +'<button id="share-dl-html" style="'+S+'background:#2563eb;color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.3);">'
    +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    +'Download HTML</button>'
    +'<button id="share-dl-txt" style="'+S+'background:var(--surface2);color:var(--text);border:1px solid var(--border);">'
    +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    +'Download TXT</button>'
    +'</div>'
    +'<p style="font-size:10px;color:var(--muted);margin-top:10px;">The HTML report is self-contained — open it in any browser or email it to your team.</p>'
    +'</div>';

  // ── Wire tab switching ──
  panel.querySelectorAll('.sp-tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var id=btn.getAttribute('data-spid');
      panel.querySelectorAll('.sp-tab-btn').forEach(function(b){ b.style.color='var(--dim)'; b.style.borderBottomColor='transparent'; });
      btn.style.color='var(--accent)'; btn.style.borderBottomColor='var(--accent)';
      panel.querySelectorAll('.sp-panel').forEach(function(p){ p.style.display='none'; });
      var target=panel.querySelector('.sp-panel[data-spid="'+id+'"]');
      if(target) target.style.display='block';
    });
  });


  document.getElementById('share-dl-html').addEventListener('click', function() {
    var SEV_COLOR={critical:'#dc2626',high:'#ea580c',medium:'#d97706',low:'#16a34a'};
    var sevColor=SEV_COLOR[d.sev]||'#6b7280';
    var topC = d.components.filter(function(x){return x.error>0||x.warn>0;}).slice(0,10);

    // ── helpers ──
    function he(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function lvColor(lv){ return lv==='fatal'?'#991b1b':lv==='error'?'#dc2626':lv==='warn'?'#d97706':lv==='info'?'#059669':'#6b7280'; }
    function lvBg(lv){ return lv==='fatal'?'#fef2f2':lv==='error'?'#fff5f5':lv==='warn'?'#fffbeb':lv==='info'?'#f0fdf4':'#f9fafb'; }

    function buildEntryCards(entries) {
      if (!entries||!entries.length) return '<div style="padding:20px;color:#9ca3af;font-size:13px;">No entries.</div>';
      return entries.map(function(e){
        var col=lvColor(e.level), bg=lvBg(e.level);
        var src=e.header?he(e.header.trim().slice(0,120)):'';
        var msg=e.msg?he(e.msg.trim()):'';
        var stkLines=(e.stack&&e.stack.length?e.stack:(e.body&&e.body.length>1?e.body.slice(1):[]));
        var stk=stkLines.length?'<div style="margin-top:6px;padding:6px 8px;background:#f1f5f9;border-radius:4px;font-size:10px;color:#64748b;white-space:pre-wrap;word-break:break-all;">'+he(stkLines.join('\n'))+'</div>':'';
        return '<div style="border-left:3px solid '+col+';background:'+bg+';border-radius:0 6px 6px 0;padding:10px 12px;margin-bottom:8px;">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
          +'<span style="font-size:9px;font-weight:800;color:'+col+';letter-spacing:.08em;text-transform:uppercase;">'+he(e.level)+'</span>'
          +(e.line?'<span style="font-size:10px;color:#9ca3af;">line '+e.line+'</span>':'')
          +'</div>'
          +(src?'<div style="font-size:10px;color:#6b7280;margin-bottom:3px;word-break:break-all;">'+src+'</div>':'')
          +(msg?'<div style="font-size:12px;color:#111827;word-break:break-all;">'+msg+'</div>':'')
          +stk
          +'</div>';
      }).join('');
    }

    function buildIdTable(items, label, color) {
      if (!items||!items.length) return '<div style="padding:20px;color:#9ca3af;">None found.</div>';
      return '<table style="width:100%;border-collapse:collapse;">'
        +'<thead><tr>'
        +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">'+label+'</th>'
        +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Lines</th>'
        +'<th style="padding:8px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">First Context</th>'
        +'</tr></thead><tbody>'
        +items.map(function(item){
          return '<tr>'
            +'<td style="padding:8px 10px;font-size:12px;font-weight:700;color:'+color+';border-bottom:1px solid #f3f4f6;">'+he(item.value)+'</td>'
            +'<td style="padding:8px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6;">'+item.lines.slice(0,5).join(', ')+(item.lines.length>5?' …':'')+'</td>'
            +'<td style="padding:8px 10px;font-size:10px;color:#9ca3af;word-break:break-all;border-bottom:1px solid #f3f4f6;">'+he((item.contexts&&item.contexts[0])||'')+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table>';
    }

    // ── Build tab definitions ──
    var tabs = [];
    tabs.push({id:'summary', label:'Summary', badge:''});
    var levelTabs=[
      {key:'fatal',label:'Fatal',color:'#991b1b'},
      {key:'error',label:'Error',color:'#dc2626'},
      {key:'warn', label:'Warn', color:'#d97706'},
      {key:'info', label:'Info', color:'#059669'},
    ];
    levelTabs.forEach(function(lt){
      var cnt=d.counts[lt.key]||0;
      if(cnt>0) tabs.push({id:'lv-'+lt.key, label:lt.label, badge:cnt, badgeColor:lt.color});
    });
    var CAT_INFO=[
      {key:'runtime',label:'Runtime Exceptions',color:'#ef4444'},
      {key:'auth',label:'Auth & Authorization',color:'#f97316'},
      {key:'database',label:'Database Errors',color:'#3b82f6'},
      {key:'perf',label:'Performance Issues',color:'#eab308'},
      {key:'fileio',label:'File / IO Errors',color:'#8b5cf6'},
      {key:'http',label:'API / HTTP Errors',color:'#10b981'},
      {key:'sqlite',label:'SQLite / DB Errors',color:'#f59e0b'},
      {key:'sync',label:'Sync Failures',color:'#6366f1'},
      {key:'network',label:'Network / Socket Errors',color:'#0ea5e9'},
      {key:'calendar',label:'Calendar Parse Errors',color:'#ec4899'},
      {key:'draft',label:'Draft / Compose Issues',color:'#84cc16'},
      {key:'dbinit',label:'DB Init Errors',color:'#dc2626'},
      {key:'oauth',label:'OAuth / Token Errors',color:'#ea580c'},
      {key:'wssocket',label:'WebSocket Errors',color:'#7c3aed'},
      {key:'filenotfound',label:'File / Resource Not Found',color:'#0891b2'},
      {key:'nullref',label:'Null Reference Errors',color:'#be185d'},
      {key:'parsewin',label:'Parse / Format Errors',color:'#b45309'},
      {key:'appcrash',label:'App Crash',color:'#7a0000'},
      {key:'uitablecrash',label:'UI Table Crash',color:'#991b1b'},
      {key:'kotlincrash',label:'Kotlin / KMM Crash',color:'#6d1a75'},
      {key:'uithread',label:'Main Thread Violation',color:'#5b21b6'},
    ];
    CAT_INFO.forEach(function(ci){
      if(d.catCounts&&d.catCounts[ci.key]>0) tabs.push({id:'cat-'+ci.key,label:ci.label,badge:d.catCounts[ci.key],badgeColor:ci.color,_cat:ci.key,_color:ci.color});
    });
    if(d.zuids&&d.zuids.length) tabs.push({id:'zuids',label:'ZUID',badge:d.zuids.length,badgeColor:'#0ea5e9'});
    if(d.accs&&d.accs.length) tabs.push({id:'accids',label:'Acc ID',badge:d.accs.length,badgeColor:'#8b5cf6'});
    tabs.push({id:'issues',label:'Issues',badge:''});
    tabs.push({id:'recs',label:'Recommendations',badge:''});
    if(d.piiDetails&&d.piiDetails.length) tabs.push({id:'pii',label:'PII',badge:d.piiDetails.length,badgeColor:'#9333ea'});

    // ── Build tab bar HTML ──
    var tabBarHtml = tabs.map(function(t,i){
      var badge=t.badge?'<span style="display:inline-block;font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;background:'+(t.badgeColor||'#e5e7eb')+'22;color:'+(t.badgeColor||'#6b7280')+';margin-left:4px;border:1px solid '+(t.badgeColor||'#e5e7eb')+'44;">'+t.badge+'</span>':'';
      return '<button onclick="showTab(\''+t.id+'\')" id="tab-btn-'+t.id+'" style="font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;border:none;border-bottom:2px solid '+(i===0?'#2563eb':'transparent')+';background:none;padding:8px 14px;color:'+(i===0?'#2563eb':'#6b7280')+';white-space:nowrap;transition:all .15s;">'+he(t.label)+badge+'</button>';
    }).join('');

    // ── Build tab panel content ──
    function buildSummaryHtml(){
      var errTotal=d.counts.fatal+d.counts.error;
      return '<div style="padding:20px;">'
        +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">'
        +['Total Lines|'+d.total+'|#2563eb','Fatal|'+d.counts.fatal+'|#991b1b','Errors|'+d.counts.error+'|#dc2626','Warnings|'+d.counts.warn+'|#d97706','Info|'+d.counts.info+'|#059669','PII Found|'+d.pii+'|#9333ea'].map(function(s){
          var p=s.split('|'); return '<div style="flex:1;min-width:80px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;">'
            +'<div style="font-size:22px;font-weight:900;color:'+p[2]+';">'+p[1]+'</div>'
            +'<div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-top:2px;">'+p[0]+'</div></div>';
        }).join('')
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:14px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">'
        +'<div style="flex:1;background:#e5e7eb;border-radius:6px;height:10px;overflow:hidden;"><div style="width:'+Math.min(100,parseFloat(d.errRate||0))+'%;height:100%;background:'+sevColor+';border-radius:6px;"></div></div>'
        +'<strong style="font-size:18px;color:'+sevColor+';">'+(d.errRate||0)+'%</strong>'
        +'<span style="font-size:12px;color:#6b7280;">'+errTotal+' errors in '+d.total.toLocaleString()+' lines</span>'
        +'</div>'
        +(topC.length?'<div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:800;color:#2563eb;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">Top Components by Errors</div>'
        +'<table style="width:100%;border-collapse:collapse;"><thead><tr>'
        +'<th style="padding:7px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Component</th>'
        +'<th style="padding:7px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Errors</th>'
        +'<th style="padding:7px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Warnings</th>'
        +'</tr></thead><tbody>'
        +topC.map(function(c){ return '<tr><td style="padding:7px 10px;font-size:12px;font-weight:600;border-bottom:1px solid #f3f4f6;">'+he(c.name)+'</td><td style="padding:7px 10px;color:#dc2626;font-weight:700;border-bottom:1px solid #f3f4f6;">'+c.error+'</td><td style="padding:7px 10px;color:#d97706;font-weight:700;border-bottom:1px solid #f3f4f6;">'+c.warn+'</td></tr>'; }).join('')
        +'</tbody></table></div>':'')
        +'</div>';
    }

    var panelContents = {};
    panelContents['summary'] = buildSummaryHtml();

    levelTabs.forEach(function(lt){
      if(d.counts[lt.key]>0){
        var ents=d.entries.filter(function(e){ return e.level===lt.key; });
        panelContents['lv-'+lt.key]='<div style="padding:16px;">'+buildEntryCards(ents)+'</div>';
      }
    });

    CAT_INFO.forEach(function(ci){
      if(d.catCounts&&d.catCounts[ci.key]>0){
        var ents=d.entries.filter(function(e){ return e.cat===ci.key&&(e.level==='fatal'||e.level==='error'||e.level==='warn'); });
        panelContents['cat-'+ci.key]='<div style="padding:16px;">'+buildEntryCards(ents)+'</div>';
      }
    });

    if(d.zuids&&d.zuids.length) panelContents['zuids']='<div style="padding:16px;">'+buildIdTable(d.zuids,'ZUID','#0ea5e9')+'</div>';
    if(d.accs&&d.accs.length) panelContents['accids']='<div style="padding:16px;">'+buildIdTable(d.accs,'Acc ID','#8b5cf6')+'</div>';

    panelContents['issues']='<div style="padding:16px;">'
      +(d.issues.length?d.issues.map(function(i){
        var bg=i.lv==='FATAL'?'#991b1b':i.lv==='ERROR'?'#dc2626':i.lv==='WARN'?'#d97706':'#059669';
        return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f3f4f6;">'
          +'<span style="flex-shrink:0;font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;color:#fff;background:'+bg+';letter-spacing:.06em;margin-top:2px;">'+he(i.lv)+'</span>'
          +'<div><div style="font-size:12px;font-weight:700;margin-bottom:2px;">'+he(i.title)+'</div><div style="font-size:11px;color:#6b7280;">'+he(i.desc)+'</div></div>'
          +'</div>';
      }).join(''):'<div style="color:#9ca3af;font-size:13px;">No issues detected.</div>')
      +'</div>';

    panelContents['recs']='<div style="padding:16px;">'
      +(d.recs.length?d.recs.map(function(r,i){
        return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f3f4f6;">'
          +'<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+(i+1)+'</div>'
          +'<div style="font-size:12px;color:#374151;padding-top:3px;">'+he(r)+'</div>'
          +'</div>';
      }).join(''):'<div style="color:#9ca3af;font-size:13px;">No recommendations.</div>')
      +'</div>';

    if(d.piiDetails&&d.piiDetails.length){
      var piiByType={};
      d.piiDetails.forEach(function(f){ piiByType[f.type]=(piiByType[f.type]||0)+1; });
      var piiTypeColors={'Email':'#2563eb','Mail Address':'#7c3aed','Person Name':'#0891b2','Public IP':'#dc2626','Private IP':'#d97706','Phone Number':'#059669','SSN (US)':'#991b1b'};
      var chips=Object.keys(piiByType).map(function(t){
        return '<span style="display:inline-block;border:1px solid #9333ea44;background:#9333ea11;color:#9333ea;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;margin:2px;">'+he(t)+': '+piiByType[t]+'</span>';
      }).join('');
      var piiCards=d.piiDetails.map(function(f){
        var col=piiTypeColors[f.type]||'#9333ea';
        return '<div style="border:1px solid #e5e7eb;border-left:3px solid '+col+';border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:10px;">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
          +'<span style="font-size:9px;font-weight:800;color:'+col+';letter-spacing:.1em;text-transform:uppercase;">'+he(f.type)+'</span>'
          +'<span style="font-size:11px;color:#9ca3af;">line '+f.line+'</span></div>'
          +'<div style="font-size:13px;font-weight:700;color:'+col+';margin-bottom:4px;word-break:break-all;">'+he(f.value)+'</div>'
          +'<div style="font-size:11px;color:#6b7280;word-break:break-all;background:#f9fafb;border-radius:4px;padding:6px 8px;margin-top:6px;">'+he(f.ctx)+'</div>'
          +'</div>';
      }).join('');
      panelContents['pii']='<div style="padding:16px;">'
        +'<div style="color:#6b7280;font-size:12px;margin-bottom:12px;">Redact before sharing or storing logs externally.</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">'+chips+'</div>'
        +piiCards+'</div>';
    }

    // ── Build panels HTML ──
    var panelsHtml = tabs.map(function(t,i){
      return '<div id="panel-'+t.id+'" style="display:'+(i===0?'block':'none')+';">'+( panelContents[t.id]||'<div style="padding:20px;color:#9ca3af;">No data.</div>')+'</div>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Log Analysis Report</title>'
      +'<style>'
      +'*{box-sizing:border-box;margin:0;padding:0;}'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#f4f6fa;color:#111827;line-height:1.6;}'
      +'.page{max-width:960px;margin:0 auto;padding:0 0 40px;}'
      +'.rpt-header{background:linear-gradient(135deg,#010b1f 0%,#081d55 60%,#0d2680 100%);padding:24px 32px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;}'
      +'.sev-badge{font-size:12px;font-weight:800;padding:5px 16px;border-radius:6px;letter-spacing:.1em;color:#fff;}'
      +'.tab-bar{display:flex;flex-wrap:wrap;background:#fff;border-bottom:1px solid #e5e7eb;padding:0 16px;gap:0;}'
      +'.tab-panels{background:#fff;border:1px solid #e5e7eb;border-top:none;min-height:300px;}'
      +'.card-wrap{padding:16px 20px;}'
      +'table{width:100%;border-collapse:collapse;}'
      +'</style>'
      +'<script>'
      +'function showTab(id){'
      +'  document.querySelectorAll("[id^=\'panel-\']").forEach(function(p){p.style.display="none";});'
      +'  document.querySelectorAll("[id^=\'tab-btn-\']").forEach(function(b){b.style.color="#6b7280";b.style.borderBottomColor="transparent";});'
      +'  var p=document.getElementById("panel-"+id);if(p)p.style.display="block";'
      +'  var b=document.getElementById("tab-btn-"+id);if(b){b.style.color="#2563eb";b.style.borderBottomColor="#2563eb";}'
      +'}'
      +'</script>'
      +'</head><body><div class="page">'

      // Header
      +'<div class="rpt-header">'
      +'<div>'
      +'<div style="font-size:22px;font-weight:900;letter-spacing:-.02em;">Log Analysis Report</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:6px;">'+(d.fileName?'<strong>'+he(d.fileName)+'</strong> &nbsp;·&nbsp; ':'')+' Generated: '+new Date().toLocaleString()+(d.firstTs?'<br>Time range: '+he(d.firstTs)+' → '+he(d.lastTs):'')+'</div>'
      +'</div>'
      +'<span class="sev-badge" style="background:'+sevColor+';">'+he(d.sev.toUpperCase())+'</span>'
      +'</div>'

      // Tab bar
      +'<div class="tab-bar">'+tabBarHtml+'</div>'

      // Tab panels
      +'<div class="tab-panels">'+panelsHtml+'</div>'

      +'<div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:20px;">Generated by Log Analyzer · '+new Date().toLocaleDateString()+'</div>'
      +'</div></body></html>';

    var blob = new Blob([html], {type:'text/html'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'log-report-'+new Date().toISOString().slice(0,10)+'.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('share-dl-txt').addEventListener('click', function() {
    var lines = [];
    lines.push('LOG ANALYZER REPORT');
    lines.push('===================');
    if (d.fileName) lines.push('File        : ' + d.fileName);
    lines.push('Generated: ' + new Date().toLocaleString());
    lines.push('');
    lines.push('SUMMARY');
    lines.push('-------');
    lines.push('Total Lines : ' + d.total.toLocaleString());
    lines.push('Fatal       : ' + d.counts.fatal);
    lines.push('Errors      : ' + d.counts.error);
    lines.push('Warnings    : ' + d.counts.warn);
    lines.push('Info        : ' + d.counts.info);
    lines.push('Severity    : ' + d.sev.toUpperCase());
    lines.push('Error Rate  : ' + errRate + '%');
    if (d.firstTs) lines.push('Time Range  : ' + d.firstTs + ' → ' + d.lastTs);
    lines.push('');
    lines.push('ISSUES');
    lines.push('------');
    d.issues.forEach(function(iss){ lines.push('['+iss.lv+'] '+iss.title+' — '+iss.desc); });
    lines.push('');
    lines.push('RECOMMENDATIONS');
    lines.push('---------------');
    d.recs.forEach(function(r,i){ lines.push((i+1)+'. '+r); });
    if (d.components.length) {
      lines.push('');
      lines.push('COMPONENTS');
      lines.push('----------');
      d.components.forEach(function(comp){ lines.push(comp.name+' — '+comp.error+' err, '+comp.warn+' warn'); });
    }
    var blob = new Blob([lines.join('\n')], {type:'text/plain'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'log-report-'+new Date().toISOString().slice(0,10)+'.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

}

// ═══════════════════════════════════════════════════════════
//  WIRE FEATURE TABS (called from analyzeBtn click handler)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════════════
function openModal(title, renderFn) {
  document.getElementById('modal-title').textContent = title;
  var body = document.getElementById('modal-body');
  body.innerHTML = '';
  var panelId = 'modal-inner-panel';
  body.innerHTML = '<div id="'+panelId+'"></div>';
  renderFn(panelId);
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-body').innerHTML = '';
}
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});

function wireFeatureTabs(entries, reportData) {
  // 1. Timeline — render immediately into panel
  var tlPanel = document.getElementById('panel-timeline');
  if (tlPanel) tlPanel.innerHTML = buildTimeline(entries);

  // Lazy: register renderers that fire on first tab click

  // Wire toolbar shortcut buttons
  // document.getElementById('aiTabBtn').onclick    = function(){ openModal('✨ AI Diagnosis', function(pid){ renderAIPanel(pid, reportData); }); };
  document.getElementById('shareTabBtn').onclick  = function(){ openModal('⬇ Download / Share', function(pid){ renderSharePanel(pid, reportData); }); };
}
