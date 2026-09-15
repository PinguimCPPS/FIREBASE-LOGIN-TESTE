/**
 * App.js
 * ---------------------------------------------------------------------------
 * Componente raiz. Responsabilidade única: decidir QUAL tela mostrar.
 *
 * São três estados possíveis, e não dois:
 *   verificando === true   -> ainda não sabemos se há sessão  -> CarregandoScreen
 *   usuario !== null       -> há usuário autenticado          -> HomeScreen
 *   usuario === null       -> não há usuário                  -> LoginScreen
 *
 * Confundir "ainda não sei" com "não há usuário" é o erro que faz o app piscar
 * a tela de login a cada abertura.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";

import { configurarGoogleSignin, observarUsuario } from "./src/services/autenticacao";
import CarregandoScreen from "./src/screens/CarregandoScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";

const App = () => {
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    configurarGoogleSignin();

    // observarUsuario devolve a função de cancelamento. Ao retorná-la no
    // useEffect, o React a executa quando o componente é desmontado, evitando
    // que o listener continue vivo (vazamento de memória).
    const cancelarObservacao = observarUsuario((usuarioAtual) => {
      setUsuario(usuarioAtual);
      setVerificando(false);
    });

    return cancelarObservacao;
  }, []); // array vazio: executa uma única vez, na montagem

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {verificando ? (
        <CarregandoScreen />
      ) : usuario ? (
        <HomeScreen usuario={usuario} />
      ) : (
        <LoginScreen />
      )}
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
