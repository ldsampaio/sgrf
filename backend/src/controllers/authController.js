// O sgrf não autentica credencial: `login`, `refresh`, `changePassword` e
// `forgotPassword` foram removidos. Sessão, cookie e credencial são do saga.
// Só `me` permanece — e `me` lê `req.user` montado pelo Redis, não do banco.

async function me(req, res) {
  const u = req.user;
  res.json({
    user: {
      id: u.id,
      login: u.login,
      name: u.name,
      email: u.email,
      roleBase: u.roleBase,
      role: u.role,
    },
  });
}

module.exports = { me };
