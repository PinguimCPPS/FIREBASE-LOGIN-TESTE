<<<<<<< HEAD
"# FIREBASE-LOGIN-TESTE" 
=======
# Login com Google + Firebase Authentication em React Native

**Instituto Federal do Triângulo Mineiro** — Curso Superior de Computação
Disciplina: Desenvolvimento para Dispositivos Móveis

Exemplo comentado de autenticação social, construído a partir da análise de duas
implementações reais. O objetivo não é apenas "fazer o login funcionar", mas
mostrar **onde as versões ingênuas quebram** e por que a estrutura abaixo evita
cada um desses problemas.

---

## 1. A ideia central

O Google **identifica** o usuário. O Firebase **mantém a sessão** do aplicativo.

```
┌──────────┐  1. signIn()   ┌────────────┐
│   App    │ ─────────────► │   Google   │
│          │ ◄───────────── │            │
└──────────┘   2. idToken   └────────────┘
     │
     │ 3. GoogleAuthProvider.credential(idToken)
     │ 4. signInWithCredential(auth, credencial)
     ▼
┌──────────────────┐
│ Firebase Auth    │  ──► uid estável, token verificável no servidor,
│ (sessão do app)  │      regras do Firestore/Storage, sessão persistente
└──────────────────┘
```

Um app que faz apenas o passo 1 e 2 e guarda o perfil em `useState` tem um
*login social*, não uma *autenticação*. Não existe nada que um servidor possa
verificar, e a sessão morre ao fechar o aplicativo.

---

## 2. Estrutura dos arquivos

```
App.js                          decide qual tela mostrar (três estados)
firebaseConfig.js               inicializa o Firebase com persistência
.env.example                    modelo das variáveis de ambiente
src/
  services/
    autenticacao.js             todo o contato com Google e Firebase
  screens/
    CarregandoScreen.js         enquanto a sessão é verificada
    LoginScreen.js              botão oficial + carregando + erro
    HomeScreen.js               dados do usuário + sair
```

A regra de organização é simples: **as telas não conhecem o Firebase**. Elas
chamam funções do serviço. Se a identidade migrar para um backend próprio,
apenas `src/services/autenticacao.js` muda.

---

## 3. Configuração passo a passo

### 3.1 Criar o projeto

```bash
npx create-expo-app exemplo-login-google --template blank
cd exemplo-login-google
npx expo install firebase @react-native-async-storage/async-storage
npx expo install @react-native-google-signin/google-signin
```

### 3.2 Firebase Console

1. Criar um projeto em <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Google → Ativar.**
3. Adicionar um app Android. O *nome do pacote* deve ser exatamente o
   `android.package` do `app.json` (ex.: `br.edu.iftm.exemplologin`).
4. Informar a **impressão digital SHA-1** (obrigatória, senão o login falha com
   `DEVELOPER_ERROR`):

```bash
# chave de depuração
keytool -list -v -keystore ~/.android/debug.keystore \
        -alias androiddebugkey -storepass android -keypass android
```

5. Baixar o `google-services.json` e colocá-lo na raiz do projeto.

### 3.3 Obter o `webClientId`

Abrir o `google-services.json` e procurar, dentro de `oauth_client`, a entrada
com `"client_type": 3`. O valor de `client_id` é o **webClientId**.

> Erro clássico: usar o client ID do tipo 1 (Android). O login até acontece,
> mas `idToken` volta `undefined` e o Firebase nunca recebe a credencial.

### 3.4 `app.json`

```json
{
  "expo": {
    "android": {
      "package": "br.edu.iftm.exemplologin",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": ["@react-native-google-signin/google-signin"]
  }
}
```

### 3.5 Variáveis de ambiente

```bash
cp .env.example .env      # e preencha com os valores do console
echo ".env" >> .gitignore
echo "google-services.json" >> .gitignore
```

### 3.6 Gerar o *development build*

**Este exemplo não roda no Expo Go.** A biblioteca do Google Sign-In possui
código nativo, e o Expo Go só embarca os módulos nativos que já vêm com ele.

```bash
npx expo prebuild
npx expo run:android
```

---

## 4. Os cinco pontos de discussão em aula

### 4.1 Cancelar o login não lança exceção (versão 13+)

A partir da versão 13 da biblioteca, desistir do login faz `signIn()` **resolver**
com `{ type: "cancelled", data: null }` em vez de lançar erro.

```js
// ERRADO — o objeto é "truthy" e passa no if
const usuario = await GoogleSignin.signIn();
if (usuario) mostrarHome(usuario);       // entra aqui mesmo ao cancelar!
// ...e depois estoura em usuario.data.user.photo

// CERTO
const resposta = await GoogleSignin.signIn();
if (resposta.type === "cancelled") return;
const idToken = resposta.data?.idToken;
```

Bom gancho para discutir **contrato de retorno de biblioteca** e por que ler o
CHANGELOG faz parte do trabalho.

### 4.2 O estado do usuário não deve ser propagado "na mão"

Passar `setUser` como prop para a tela de login funciona — até o app ser
reaberto. O `onAuthStateChanged` resolve login, logout e restauração de sessão
com um único mecanismo:

```js
useEffect(() => {
  configurarGoogleSignin();
  return observarUsuario(setUsuario);   // o retorno cancela o listener
}, []);
```

### 4.3 Três estados, não dois

`usuario === null` significa "não há usuário" **e também** "ainda não verifiquei".
Sem a flag `verificando`, a tela de login pisca a cada abertura.

### 4.4 O `finally` que salva o indicador de carregamento

```js
setCarregando(true);
try { await entrarComGoogle(); }
catch (e) { setErro(descreverErro(e)); }
finally { setCarregando(false); }   // sempre executa
```

Sem o `finally`, um erro deixa o `ActivityIndicator` girando para sempre.

### 4.5 Logout é duplo

`GoogleSignin.signOut()` esquece a conta escolhida no aparelho;
`signOut(auth)` derruba a sessão do Firebase. Fazer só um dos dois produz bugs
diferentes e igualmente confusos.

---

## 5. Erros mais comuns

| Sintoma | Causa provável |
|---|---|
| `DEVELOPER_ERROR` | SHA-1 não cadastrado ou nome do pacote divergente |
| `idToken` vem `undefined` | `webClientId` ausente ou do tipo errado (use o `client_type: 3`) |
| App volta deslogado após reabrir | `getAuth()` no lugar de `initializeAuth` com `AsyncStorage` |
| Login entra sempre na mesma conta | faltou `GoogleSignin.signOut()` no logout |
| `PLAY_SERVICES_NOT_AVAILABLE` | emulador sem Google Play |
| Erro de módulo nativo ao abrir | rodando no Expo Go em vez de *development build* |

---

## 6. Exercícios propostos

1. Exibir a data do último acesso usando `usuario.metadata.lastSignInTime`.
2. Bloquear o acesso a contas fora do domínio `@iftm.edu.br`, encerrando a
   sessão e avisando o usuário quando o e-mail não corresponder.
3. Gravar, no Firestore, um documento na coleção `usuarios` com o `uid` como
   identificador, criado no primeiro login e atualizado nos seguintes.
4. Acrescentar o login anônimo (`signInAnonymously`) e, depois, vincular a conta
   Google à sessão anônima com `linkWithCredential`, preservando os dados.
5. Extrair a lógica de sessão para um *hook* `useAutenticacao()` que devolva
   `{ usuario, verificando, entrar, sair, erro }`, e simplificar `App.js`.
>>>>>>> d7754ea73c6fdacc8c1c7d9e9604491d517bce6d
