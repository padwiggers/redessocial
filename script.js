// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================

const SUPABASE_URL =
    "https://ubxocyewlbqzqbfslrvt.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_zbWweSWeD5iO1Ubz7YepKQ_Iwm_3g18";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Nome do bucket de imagens
const NOME_BUCKET = "postagens-imagens";

// Filtro atual da pesquisa
let filtroAtual = "";

// Arquivo de imagem selecionado
let arquivoSelecionado = null;

// Elementos da página
const feed = document.getElementById("feed");
const formulario = document.getElementById("form-container");
const pesquisa = document.getElementById("search-container");
const filtroContainer = document.getElementById("filtro-container");
const textoFiltro = document.getElementById("texto-filtro");

const inputImagem = document.getElementById("imagem");
const previewContainer = document.getElementById("preview-container");
const previewImagem = document.getElementById("preview-imagem");


// ==========================================
// ABRIR E FECHAR FORMULÁRIO
// ==========================================

function toggleFormulario() {
    formulario.classList.toggle("ativo");
}


// ==========================================
// ABRIR E FECHAR PESQUISA
// ==========================================

function togglePesquisa() {
    pesquisa.classList.toggle("ativo");
}


// ==========================================
// ESCAPAR HTML
// Evita problemas ao mostrar textos na tela
// ==========================================

function escaparHTML(texto) {
    const elemento = document.createElement("div");

    elemento.textContent = texto ?? "";

    return elemento.innerHTML;
}


// ==========================================
// PRÉ-VISUALIZAÇÃO DA IMAGEM
// ==========================================

inputImagem.addEventListener("change", function (event) {

    const arquivo = event.target.files[0];

    if (!arquivo) {
        removerImagem();
        return;
    }

    if (!arquivo.type.startsWith("image/")) {
        alert("Escolha um arquivo de imagem válido.");
        removerImagem();
        return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
        alert("A imagem deve ter no máximo 5 MB.");
        removerImagem();
        return;
    }

    arquivoSelecionado = arquivo;

    const leitor = new FileReader();

    leitor.onload = function (evento) {
        previewImagem.src = evento.target.result;
        previewContainer.classList.add("ativo");
    };

    leitor.readAsDataURL(arquivo);

});


// ==========================================
// REMOVER IMAGEM
// ==========================================

function removerImagem() {

    arquivoSelecionado = null;

    inputImagem.value = "";

    previewImagem.src = "";

    previewContainer.classList.remove("ativo");

}


// ==========================================
// FAZER UPLOAD DA IMAGEM
// ==========================================

async function fazerUploadImagem(arquivo) {

    if (!arquivo) {
        return null;
    }

    const nomeSeguro = arquivo.name
        .replace(/[^a-zA-Z0-9._-]/g, "_");

    const nomeArquivo =
        `${Date.now()}-${Math.random().toString(36).substring(2)}-${nomeSeguro}`;

    const caminhoArquivo =
        `postagens/${nomeArquivo}`;

    const { error: erroUpload } =
        await supabaseClient.storage
            .from(NOME_BUCKET)
            .upload(caminhoArquivo, arquivo, {
                cacheControl: "3600",
                upsert: false
            });

    if (erroUpload) {
        throw erroUpload;
    }

    const { data } =
        supabaseClient.storage
            .from(NOME_BUCKET)
            .getPublicUrl(caminhoArquivo);

    return data.publicUrl;

}


// ==========================================
// CRIAR POSTAGEM
// ==========================================

async function criarPostagem(event) {

    event.preventDefault();

    const nome =
        document.getElementById("nome").value.trim();

    const texto =
        document.getElementById("texto").value.trim();

    if (!nome || !texto) {
        alert("Preencha seu nome e o texto da postagem.");
        return;
    }

    const botaoPublicar =
        document.querySelector(
            "#form-postagem button[type='submit']"
        );

    botaoPublicar.disabled = true;
    botaoPublicar.textContent = "Publicando...";

    try {

        let imagemUrl = null;

        // Faz o upload caso tenha imagem
        if (arquivoSelecionado) {
            imagemUrl = await fazerUploadImagem(arquivoSelecionado);
        }

        const { error } =
            await supabaseClient
                .from("postagens")
                .insert([
                    {
                        nome: nome,
                        texto: texto,
                        imagem_url: imagemUrl,
                        curtidas: 0,
                        comentarios: []
                    }
                ]);

        if (error) {
            throw error;
        }

        alert("Postagem publicada com sucesso!");

        document
            .getElementById("form-postagem")
            .reset();

        removerImagem();

        formulario.classList.remove("ativo");

        carregarPostagens();

    } catch (error) {

        console.error("Erro ao publicar:", error);

        alert(
            "Erro ao publicar postagem. Confira as configurações do Supabase."
        );

    } finally {

        botaoPublicar.disabled = false;
        botaoPublicar.textContent = "Publicar postagem";

    }

}


// ==========================================
// EVENTO DO FORMULÁRIO
// ==========================================

document
    .getElementById("form-postagem")
    .addEventListener("submit", criarPostagem);


// ==========================================
// CARREGAR POSTAGENS
// ==========================================

async function carregarPostagens() {

    feed.innerHTML = `
        <div class="carregando">
            Carregando postagens...
        </div>
    `;

    let consulta =
        supabaseClient
            .from("postagens")
            .select("*")
            .order("created_at", {
                ascending: false
            });

    if (filtroAtual) {

        const filtroSeguro =
            filtroAtual.replace(/[%_]/g, "");

        consulta = consulta.or(
            `texto.ilike.%${filtroSeguro}%,nome.ilike.%${filtroSeguro}%`
        );

    }

    const { data, error } = await consulta;

    if (error) {

        console.error("Erro ao carregar:", error);

        feed.innerHTML = `
            <div class="erro">
                Erro ao carregar postagens.
                Verifique a tabela "postagens".
            </div>
        `;

        return;
    }

    if (!data || data.length === 0) {

        feed.innerHTML = `
            <div class="sem-postagens">
                Nenhuma postagem encontrada.
            </div>
        `;

        return;
    }

    feed.innerHTML = "";

    data.forEach(post => {

        const postagem = document.createElement("article");

        postagem.className = "postagem";

        const dataPostagem = post.created_at
            ? new Date(post.created_at).toLocaleString("pt-BR")
            : "";

        const nome = escaparHTML(post.nome);
        const texto = escaparHTML(post.texto);

        let imagemHTML = "";

        if (post.imagem_url) {

            const imagemUrl = escaparHTML(post.imagem_url);

            imagemHTML = `
                <img
                    class="imagem-post"
                    src="${imagemUrl}"
                    alt="Imagem da postagem"
                >
            `;

        }

        let comentarios = [];

        if (Array.isArray(post.comentarios)) {
            comentarios = post.comentarios;
        }

        let comentariosHTML = "";

        if (comentarios.length === 0) {

            comentariosHTML = `
                <p>Nenhum comentário ainda.</p>
            `;

        } else {

            comentariosHTML = comentarios
                .map(comentario => `
                    <div class="comentario">
                        ${escaparHTML(comentario)}
                    </div>
                `)
                .join("");

        }

        postagem.innerHTML = `
            <h3>${nome}</h3>

            <div class="data-postagem">
                ${dataPostagem}
            </div>

            <p>${texto}</p>

            ${imagemHTML}

            <div class="acoes-postagem">

                <button
                    onclick="curtirPost(${post.id}, ${post.curtidas || 0})"
                >
                    ❤️ Curtir (${post.curtidas || 0})
                </button>

            </div>

            <div class="comentarios">

                <h4>💬 Comentários</h4>

                <div>
                    ${comentariosHTML}
                </div>

                <div class="campo-comentario">

                    <input
                        type="text"
                        id="comentario-${post.id}"
                        placeholder="Escreva um comentário..."
                    >

                    <button
                        onclick="adicionarComentario(${post.id})"
                    >
                        Enviar
                    </button>

                </div>

            </div>
        `;

        feed.appendChild(postagem);

    });

}


// ==========================================
// CURTIR POSTAGEM
// ==========================================

async function curtirPost(id, curtidasAtuais) {

    const novasCurtidas =
        (curtidasAtuais || 0) + 1;

    const { error } =
        await supabaseClient
            .from("postagens")
            .update({
                curtidas: novasCurtidas
            })
            .eq("id", id);

    if (error) {

        console.error("Erro ao curtir:", error);

        alert("Erro ao curtir postagem.");

        return;
    }

    carregarPostagens();

}


// ==========================================
// ADICIONAR COMENTÁRIO
// ==========================================

async function adicionarComentario(id) {

    const campo =
        document.getElementById(`comentario-${id}`);

    const textoComentario =
        campo.value.trim();

    if (!textoComentario) {
        alert("Digite um comentário.");
        return;
    }

    const { data: postagem, error: erroBusca } =
        await supabaseClient
            .from("postagens")
            .select("comentarios")
            .eq("id", id)
            .single();

    if (erroBusca) {

        console.error("Erro ao buscar comentários:", erroBusca);

        alert("Erro ao buscar comentários.");

        return;
    }

    let comentariosAtuais = [];

    if (Array.isArray(postagem.comentarios)) {
        comentariosAtuais = postagem.comentarios;
    }

    comentariosAtuais.push(textoComentario);

    const { error: erroUpdate } =
        await supabaseClient
            .from("postagens")
            .update({
                comentarios: comentariosAtuais
            })
            .eq("id", id);

    if (erroUpdate) {

        console.error("Erro ao adicionar comentário:", erroUpdate);

        alert("Erro ao adicionar comentário.");

        return;
    }

    carregarPostagens();

}


// ==========================================
// EXECUTAR PESQUISA
// ==========================================

function executarPesquisa() {

    const campo =
        document.getElementById("campo-pesquisa");

    filtroAtual =
        campo.value.trim();

    if (filtroAtual) {

        filtroContainer.classList.add("ativo");

        textoFiltro.textContent =
            `Filtro atual: ${filtroAtual}`;

    } else {

        filtroContainer.classList.remove("ativo");

    }

    carregarPostagens();

}


// ==========================================
// LIMPAR FILTRO
// ==========================================

function limparFiltro() {

    filtroAtual = "";

    document
        .getElementById("campo-pesquisa")
        .value = "";

    filtroContainer.classList.remove("ativo");

    carregarPostagens();

}


// ==========================================
// INICIAR O SITE
// ==========================================

carregarPostagens();