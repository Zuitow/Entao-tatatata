////////////////////////////////// Login

const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const port = 3000;
const register = require('./register.js');
const app = express();
const consulta = require('./consulta.js');

// Configurar a conexão com o banco de dados MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'phpmyadmin',
  password: 'isabila',
  database: 'medical',
});

// Configurar o middleware bodyParser
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar sessões
app.use(session({ secret: 'secreto', resave: false, saveUninitialized: false }));

// Inicializar o Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Configurar a estratégia de autenticação local
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      console.log('Tentando autenticar usuário:', username);
      const [rows] = await db.promise().query('SELECT * FROM user WHERE username = ?', [username]);
      const user = rows[0];

      if (!user) {
        console.log('Usuário não encontrado:', username);
        return done(null, false, { message: 'Usuário não encontrado.' });
      }

      // Verificar a senha usando bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        console.log('Senha incorreta para o usuário:', username);
        return done(null, false, { message: 'Senha incorreta.' });
      }
      console.log('Usuário autenticado com sucesso:', username);
      return done(null, user);
    } catch (err) {
      console.error('Erro durante a autenticação:', err);
      return done(err);
    }
  }
));

app.get('/consultas', (req, res) => {
res.render('consultas'); // Use o mecanismo de visualização que preferir
});
  // Lógica para a rota "/consulta"


// Marcar Consultas - Removi uma função desnecessária
app.post('/marcarConsulta', async (req, res) => {
  const { nomepaciente, nomemedico, hora, dataconsulta, motivo } = req.body;
  console.log(`${nomepaciente}, ${nomemedico}, ${hora}, ${dataconsulta}, ${motivo}`);
  // Inserir a nova consulta no banco de dados
  const SQL = 'INSERT INTO agendamentos (nomepaciente, nomemedico, hora, dataconsulta, motivo) VALUES (?, ?, ?, ?, ?)';
  db.query(SQL, [nomepaciente, nomemedico, hora, dataconsulta, motivo], (err, result) => {
    if (err) {
      console.error('Erro ao cadastrar consulta:', err);
      res.status(500).send('Erro ao cadastrar consulta.');
    } else {
      console.log('Consulta cadastrada com sucesso!');
      res.redirect('/dashboard');  // Corrigi o redirecionamento para '/dashboard'
    }
  });
});

// Função para cadastrar um novo usuário
async function registerUser(email, senha, nome, tipo) {
  try {
    // Verificar se o usuário já existe
    const [existingUsers] = await db.promise().query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (existingUsers.length > 0) {
      throw new Error('Conta já existe');
    }

    // Inserir o novo usuário no banco de dados
    const [result] = await db.promise().query('INSERT INTO usuarios (email, senha, nome, tipo) VALUES (?, SHA1(?), ?, ?)', [email, senha, nome, tipo]);

    if (result.insertId) {
      return result.insertId;
    } else {
      throw new Error('Erro ao cadastrar o usuário.');
    }
  } catch (error) {
    throw error;
  }
}

// Nova rota para registro de usuário
app.post('/register', async (req, res) => {
  const { email, senha, nome, tipo } = req.body;

  try {
    const userId = await registerUser(email, senha, nome, tipo);
    // Usuário cadastrado com sucesso
    console.log(nome,'foi cadastrado com sucesso com email:',email,' e senha:',senha,' e é um', tipo)
    res.status(200).redirect(`/login`);
  } catch (error) {
    // Lidar com erros de cadastro
    res.status(400).send(`Erro no cadastro: ${error.message}`);
  }
});

//Serializar
passport.serializeUser((user, done) => {
  console.log('Serializando usuário:', user.id);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  console.log('Desserializando usuário com ID:', id);
  try {
    const [rows] = await db.promise().query('SELECT * FROM user WHERE id = ?', [id]);
    const user = rows[0];

    if (!user) {
      console.log('Usuário não encontrado para ID:', id);
      return done(null, false); // Usuário não encontrado
    }

    console.log('Usuário recuperado:', user);
    done(null, user);
  } catch (err) {
    console.error('Erro durante a desserialização:', err);
    done(err);
  }
});


// Configurar EJS como o motor de visualização
app.set('view engine', 'ejs');

// Rota para a página index
app.get('/', (req, res) => {
  res.render('index'); // Use o mecanismo de visualização que preferir
});


app.post('/login', (req, res) => {
    const { email, senha, } = req.body;
    const query = 'SELECT * FROM usuarios WHERE email = ? AND senha = SHA1(?)';
    const nome = 'SELECT nome FROM usuarios';

    db.query(query, [email, senha], (err, result) => {
        if (err) {
            console.error('Erro ao verificar o login:', err);
            res.status(500).send('Erro ao verificar o login.');
        } else {
            
            if (result.length > 0) {
                // Usuário autenticado com sucesso
                console.log('Login bem-sucedido de:', nome);

                // Adicione a mensagem de sucesso e redirecionamento aqui
                res.status(200).redirect(`/consultas`);
    
            } else {
                // Usuário não encontrado ou credenciais incorretas
                console.log('Login falhou para o email:', email, ' e senha:', senha);
                res.status(401).send({
                    success: false,
                    message: 'Credenciais incorretas. Tente novamente.'
                });
            }
        }
    });
});


// Rota para a página de login
app.get('/login', (req, res) => {
  res.render('login'); // Use o mecanismo de visualização que preferir
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard', // Redirecionamento após login bem-sucedido
  failureRedirect: '/login',    // Redirecionamento após falha de login
  failureFlash: true,          // Permite o uso de mensagens flash
}));


// Rota protegida - exemplo da página de dashboard
app.get('/dashboard', (req, res) => {
  if (req.isAuthenticated()) {
    res.send('Você está logado.');
    console.log('Usuário logado');
  } else {
    console.log('Usuário inválido');
    res.redirect('/login');
  }
});

app.get('/formulario', (req, res) => {
  res.render('formulario'); // Use o mecanismo de visualização que preferir

});

// Rota protegida - exemplo da página de dashboard
//app.get('/fechar.html', (req, res) => {
 // if (req.isAuthenticated()) {
  //  res.send('Você está logado.');
   // console.log('Usuário logado');
  
    //res.redirect('window.close;');
 // } else {
   // console.log('Usuário inválido');
   // res.redirect('/login');
 // }
//});

// Servir arquivos estáticos
app.use(express.static(__dirname + '/'));

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor Express está rodando na porta ${port}`);
});

