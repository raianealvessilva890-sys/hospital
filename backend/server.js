const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: []
    };
  }

 const db = JSON.parse(fs.readFileSync(DB_FILE));

if (!db.estoque) {
  db.estoque = [];
}

return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// LOGIN
app.post("/login", (req, res) => {
  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({
      erro: "Login inválido"
    });
  }

  res.json(user);
});

// ATENDIMENTO
app.post("/atendimento", (req, res) => {
  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);
  writeDB(db);

  res.json(paciente);
});

// TRIAGEM
app.post("/triagem", (req, res) => {
  const db = readDB();

  let risco = req.body.risco;

  if (req.body.temperatura >= 39) {
    risco = "vermelho";
  } else if (req.body.temperatura >= 38) {
    risco = "amarelo";
  } else if (!risco) {
    risco = "verde";
  }

  const triagem = {
    id: Date.now(),
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens.push(triagem);
  writeDB(db);

  res.json(triagem);
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});

// IMPLEMENTADO: rota com lista fixa de medicações
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});


 // CONSULTA
app.post("/consulta", (req, res) => {
  const db = readDB();

  const { paciente, diagnostico, medicacao, obs } = req.body;

  if (!paciente || !medicacao) {
    return res.status(400).json({ erro: "Selecione o paciente e a medicação." });
  }

  // Procura o medicamento no estoque
  const medicamentoEstoque = (db.estoque || []).find(
    m => m.nome.toLowerCase() === medicacao.trim().toLowerCase()
  );

  if (!medicamentoEstoque) {
    return res.status(404).json({ erro: "Medicamento não encontrado no estoque." });
  }

  // Verifica se existe quantidade disponível
  if (medicamentoEstoque.quantidade < 1) {
    return res.status(400).json({ erro: "Estoque insuficiente!" });
  }

  // Desconta 1 unidade do estoque
  medicamentoEstoque.quantidade -= 1;

  const consulta = {
    id: Date.now(),
    paciente,
    diagnostico,
    medicacao,
    obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);
  writeDB(db);

  res.json({
    mensagem: "Consulta salva e estoque atualizado!",
    consulta,
    estoqueRestante: medicamentoEstoque.quantidade
  });
});


// MEDICAÇÕES
app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.consultas);
});


// CADASTRAR USUÁRIO
app.post("/usuarios", (req, res) => {
  const db = readDB();

  const { usuario, senha, tipo } = req.body;

  if (!usuario || !senha || !tipo) {
    return res.status(400).json({
      erro: "Preencha todos os campos."
    });
  }

  if (!["atendimento", "triagem", "medico"].includes(tipo)) {
    return res.status(400).json({
      erro: "Setor inválido."
    });
  }

  if (db.usuarios.some(u => u.usuario === usuario)) {
    return res.status(409).json({
      erro: "Esse usuário já está cadastrado."
    });
  }

  const novoUsuario = { usuario, senha, tipo };

  db.usuarios.push(novoUsuario);
  writeDB(db);

  res.status(201).json({
    mensagem: "Usuário cadastrado com sucesso."
  });
});

// LISTAR USUÁRIOS
app.get("/usuarios", (req, res) => {
  const db = readDB();

  // Não enviar as senhas para o navegador
  const usuarios = db.usuarios.map(u => ({
    usuario: u.usuario,
    tipo: u.tipo
  }));

  res.json(usuarios);
});



// ESTOQUE - LISTAR MEDICAMENTOS
app.get("/estoque", (req, res) => {
  const db = readDB();
  res.json(db.estoque || []);
});

// ESTOQUE - CADASTRAR MEDICAMENTO
app.post("/estoque", (req, res) => {
  const db = readDB();

  const { nome, quantidade, unidade, categoria } = req.body;

  if (!nome || !Number.isInteger(Number(quantidade)) || Number(quantidade) <= 0) {
    return res.status(400).json({ erro: "Dados inválidos." });
  }

  const medicamento = {
    id: Date.now(),
    nome,
    quantidade: Number(quantidade),
    unidade,
    categoria
  };

  db.estoque.push(medicamento);
  writeDB(db);

  res.status(201).json({
    mensagem: "Medicamento cadastrado!",
    medicamento
  });
});

// ESTOQUE - ATUALIZAR QUANTIDADE
app.put("/estoque/:id", (req, res) => {
  const db = readDB();

  const medicamento = db.estoque.find(
    m => m.id == req.params.id
  );

  if (!medicamento) {
    return res.status(404).json({ erro: "Medicamento não encontrado." });
  }

  const quantidade = Number(req.body.quantidade);

  if (!Number.isInteger(quantidade) || quantidade === 0) {
    return res.status(400).json({ erro: "Quantidade inválida." });
  }

  if (medicamento.quantidade + quantidade < 0) {
    return res.status(400).json({ erro: "Estoque insuficiente." });
  }

  medicamento.quantidade += quantidade;
  writeDB(db);

  res.json({ medicamento });
});

// ESTOQUE - REMOVER MEDICAMENTO
app.delete("/estoque/:id", (req, res) => {
  const db = readDB();

  db.estoque = db.estoque.filter(
    m => m.id != req.params.id
  );

  writeDB(db);

  res.json({ mensagem: "Medicamento removido." });
});


// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🏥 Hospital Pro rodando na porta ${PORT}`);
});
