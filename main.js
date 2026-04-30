(async function () {
    const ano = prompt("Qual ano deseja analisar?", new Date().getFullYear());
    if (!ano) return;

    const overlay = document.createElement('div');
    overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-family:sans-serif;";
    overlay.innerHTML = `<h2>Gerando Dashboard de ${ano}...</h2><p id='status'>Iniciando...</p><div style='width:200px;height:10px;background:#444;margin-top:10px;'><div id='progress' style='width:0%;height:100%;background:#3b82f6;transition:width 0.3s;'></div></div>`;
    document.body.appendChild(overlay);

    let notasGlobais = [];
    for (let mes = 1; mes <= 12; mes++) {
        document.getElementById('status').innerText = `Processando Mês ${mes}/12`;
        document.getElementById('progress').style.width = `${(mes / 12) * 100}%`;
        const dataInicio = `01/${mes.toString().padStart(2, '0')}/${ano}`;
        const dataFim = `${new Date(ano, mes, 0).getDate()}/${mes.toString().padStart(2, '0')}/${ano}`;
        try {
            const resp = await fetch(`https://www.nfse.gov.br/EmissorNacional/Notas/Emitidas?busca=&datainicio=${encodeURIComponent(dataInicio)}&datafim=${encodeURIComponent(dataFim)}`);
            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            doc.querySelectorAll("table tbody tr[data-chave]").forEach(row => {
                const tds = row.querySelectorAll("td");
                const tomadorCell = tds[1];
                const cnpj = tomadorCell.querySelector(".cnpj")?.textContent || "S/CNPJ";
                const chave = row.getAttribute("data-chave");
                const actionLinks = Array.from(row.querySelectorAll("a"));
                const pdfHref = actionLinks.find(a => {
                    const href = (a.getAttribute("href") || "").toLowerCase();
                    const text = (a.textContent || "").toLowerCase();
                    if (href.includes("xml") || text.includes("xml")) return false;
                    return href.includes("danfse") || href.includes("download/danfse") ||
                        href.includes("impressao") || href.includes("pdf") || href.includes("imprimir") ||
                        href.includes("visualizar") || href.includes("print") ||
                        text.includes("pdf") || text.includes("imprimir") || text.includes("impressão") || text.includes("visualizar");
                })?.getAttribute("href").replace("/Visualizar/Index/", "/Download/DANFSe/") || null;

                const link = pdfHref
                    ? (pdfHref.startsWith("http") ? pdfHref : "https://www.nfse.gov.br" + (pdfHref.startsWith("/") ? pdfHref : "/" + pdfHref))
                    : (chave ? `https://www.nfse.gov.br/EmissorNacional/Notas/Download/DANFSe/${chave}` : null);
                notasGlobais.push({
                    data: tds[0].innerText.trim(),
                    nome: tomadorCell.innerText.replace(cnpj, "").replace(/\s+/g, " ").trim(),
                    cnpj,
                    competencia: tds[2].innerText.trim(),
                    valor: parseFloat(row.getAttribute("data-valor").replace('.', '').replace(',', '.')),
                    situacao: row.getAttribute("data-situacao") || "",
                    chave,
                    link
                });
            });
        } catch (e) { }
    }
    document.body.removeChild(overlay);

    const validas = notasGlobais.filter(n => !n.situacao.includes("CANCELADA"));
    const total = validas.reduce((acc, n) => acc + n.valor, 0);
    const empresas = {};
    validas.forEach(n => {
        if (!empresas[n.nome]) empresas[n.nome] = { valor: 0, cnpj: n.cnpj, qtd: 0 };
        empresas[n.nome].valor += n.valor; empresas[n.nome].qtd++;
    });

    const dashWin = window.open("", "_blank");
    dashWin.document.write(`
        <html><head><title>Dashboard NFS-e ${ano}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        </head><body class="bg-gray-50 p-8 font-sans">
            <div class="max-w-6xl mx-auto">
                <header class="flex justify-between items-center mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">📊 Dashboard NFS-e <span class="text-blue-600">${ano}</span></h1>
                    <button onclick="window.print()" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Imprimir / PDF</button>
                </header>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p class="text-gray-500 text-sm font-medium uppercase">Faturamento Líquido</p>
                        <p class="text-3xl font-black text-green-600">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p class="text-gray-500 text-sm font-medium uppercase">Notas Ativas</p>
                        <p class="text-3xl font-black text-blue-600">${validas.length}</p>
                    </div>
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p class="text-gray-500 text-sm font-medium uppercase">Canceladas/Substituídas</p>
                        <p class="text-3xl font-black text-red-500">${notasGlobais.length - validas.length}</p>
                    </div>
                </div>

                <h2 class="text-xl font-bold mb-4 text-gray-700">🏢 Faturamento por Empresa</h2>
                <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mb-8">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 border-b">
                            <tr><th class="p-4 font-semibold">Empresa</th><th class="p-4 font-semibold">CNPJ</th><th class="p-4 font-semibold text-center">Qtd</th><th class="p-4 font-semibold text-right">Total</th></tr>
                        </thead>
                        <tbody>
                            ${Object.entries(empresas).sort((a, b) => b[1].valor - a[1].valor).map(([nome, info]) => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="p-4 text-gray-800 font-medium">${nome}</td>
                                    <td class="p-4 text-gray-500">${info.cnpj}</td>
                                    <td class="p-4 text-center">${info.qtd}</td>
                                    <td class="p-4 text-right font-bold text-gray-900">R$ ${info.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <h2 class="text-xl font-bold mb-4 text-gray-700">📝 Listagem Detalhada</h2>
                <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50">
                            <tr><th class="p-3">Data</th><th class="p-3">Competência</th><th class="p-3">Tomador</th><th class="p-3 text-right">Valor</th><th class="p-3 text-center">NFS</th></tr>
                        </thead>
                        <tbody>
                            ${validas.map(n => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="p-3">${n.data}</td>
                                    <td class="p-3 text-center">${n.competencia}</td>
                                    <td class="p-3">${n.nome}</td>
                                    <td class="p-3 text-right font-medium">R$ ${n.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td class="p-3 text-center">${n.link ? `<a href="${n.link}" target="_blank" title="Baixar PDF da NFS-e" class="inline-flex items-center justify-center w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors" style="text-decoration:none">📄</a>` : '<span class="text-gray-300">—</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </body></html>
    `);
    dashWin.document.close();
})();