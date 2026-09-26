# Entre peixes e Notas

Pescaria cooperativa em **primeira pessoa** para **dois jogadores**, em WebGL/Three.js. O modo de um jogador existe para testar os sistemas e a sequência narrativa. Os rostos usam as fotos originais como textura projetada na própria malha da cabeça; os arquivos GLB do ateliê incorporam essas imagens.

## Rodar

Requer Node.js 24.

```powershell
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. A opção **Testar sozinho** inicia o teste solo. O jogo usa módulos e precisa de servidor HTTP; abrir `index.html` diretamente como arquivo não funciona. `atelier.html` é o visualizador WebGL dos modelos; o botão de download exporta o modelo atual em GLB (sem a foto no rosto, que é aplicada por shader).

## Controles

| Ação | Controle |
| --- | --- |
| Olhar ao redor | Mouse (clique na tela para capturar o cursor) |
| Andar / acelerar e virar no leme | WASD ou setas |
| Correr | Shift |
| Pular os bancos | Espaço |
| Dar um tapa (no jogador à sua frente) | Botão direito do mouse |
| Assumir ou largar o leme (perto da popa, se ninguém estiver nele) | E |
| Lançar a linha na direção da mira / fisgar | F |
| Recolher: subir a marca no medidor | Segurar F |
| Recolher: deixar a marca descer | Soltar F |
| Liberar o cursor e abrir as opções | Esc |

A mira fica laranja quando o outro pescador está ao alcance do tapa. A marca deve ficar na faixa verde durante o recolhimento; a tensão alta faz o peixe escapar e andar cancela a pesca. Sair da área do barco provoca queda: ao tocar a água, o ragdoll recebe um impulso para cima e reaparece no barco. A sensibilidade do mouse fica nas opções.

## Multiplayer

O anfitrião é a autoridade sobre barco, pesca, tapas, quedas, pontuação e relógio. Cada jogador controla o próprio movimento no convés com predição local (sem atraso ao andar); o anfitrião valida e retransmite. O convidado recebe snapshots a 20 Hz, com interpolação do barco e do outro pescador, e o ping aparece no canto da tela.

**Sala com código (recomendado)**

1. Os dois abrem o jogo e escolhem personagens diferentes em **Preparar embarque**.
2. Um clica em **Criar sala** e passa o código de 5 letras ao outro.
3. O outro digita o código e clica em **Entrar**.
4. Os dois marcam **Estou pronto**.

O código é trocado pelo servidor público de sinalização do PeerJS (`0.peerjs.com`), usado apenas para os navegadores se encontrarem; os dados do jogo vão direto entre eles (WebRTC). Servidores STUN públicos (Google e Cloudflare) permitem atravessar a maioria dos roteadores domésticos pela internet, sem VPN. Não há servidor TURN: redes muito restritivas (algumas corporativas ou 4G com CGNAT simétrico) podem não conectar.

**Conexão manual** — em “Conexão manual”, os dois trocam códigos longos (convite e resposta) por mensagem. Não depende do servidor de salas.

**Teste local em duas abas** — abre a sala por BroadcastChannel no mesmo navegador. Não conecta computadores diferentes.

A desconexão pausa a partida; crie uma nova sala para jogar de novo.

## Sequência narrativa

- **0:00–1:00:** pôr do sol que vai baixando, gaivotas, pesca e navegação.
- **1:00–2:00:** nuvens fecham, chuva, relâmpagos com trovão atrasado pela distância, ondas maiores e barco instável.
- **2:00:** céu vermelho; o meteoro surge atrás do barco, cruza o céu por cima dos dois e mergulha à frente.
- **2:17:** impacto: clarão, zoom, bola de fogo, coroa d'água, destroços incandescentes, coluna de vapor e a frente de choque que chega ao barco na velocidade do som. O motor apaga.
- **2:25:** cutscene; o barco vira a proa para a onda, os dois se olham, se abraçam e se beijam enquanto a tsunami cresce e o lábio se enrola.
- **2:44:** no quadro exato em que a face da onda toca a proa, a tela apaga e o som corta.
- **2:47:** o título aparece com o último acorde.

No teste solo, só um personagem aparece durante a pescaria; o segundo aparece para a cutscene. As opções do teste solo têm atalhos para tempestade, meteoro, impacto e ragdoll.

## Modelos e animação

- **Personagens** esculpidos em código (≈5 mil triângulos cada): tronco em anéis com peito e cintura, roupas com barra, gola, emblema, capuz, zíper e cordões, mãos com quatro dedos e polegar, tênis com solado e cadarço, orelhas, cabelo em mechas (topete do pescador, franja do companheiro) e o crânio esculpido que recebe a foto.
- **Barco** de tábuas sobrepostas (clinker) sobre o mesmo perfil de casco usado pelo shader do mar: casco verde-azulado com faixa branca e fundo vermelho, alcatrate envernizado, verdugo, cavernas, piso de ripas, bancos com mãos-francesas, toletes, remos, motor de popa com hélice que gira e aponta com o leme, console com roda de seis raios, balde, caixa de pesca, rede com boias, cabo enrolado, defensas, cunhos, lanterna e o nome pintado na popa e na proa.
- **Animação procedural** por camadas: passada assimétrica com joelho na fase aérea, balanço de quadril, torção e oscilação do tronco, braços opostos, corrida mais inclinada, passo lateral, inclinação por aceleração e por curva, equilíbrio contra o balanço do barco, respiração e troca de peso, pulo e aterrissagem com mola.
- **Tapa:** antecipação (mão atrás da cabeça, tronco torcido), golpe rápido e acompanhamento com sobra. **Pesca:** arremesso com chicote, fisgada, molinete girando, corpo inclinando com a tensão e vara em seis segmentos que enverga.
- **Olhar:** as cabeças se viram uma para a outra só quando o outro está à frente ou um pouco de lado (cone de 75°), com trava de 60°; fora disso, voltam para frente.

## Pesca

Cada lançamento sorteia a espécie e o peso: sardinha, tainha, pargo-rosa, robalo, garoupa, dourado e, raramente, uma bota velha. A boia recebe beliscadas antes da mordida; fisgar rápido começa a briga com vantagem. Durante o recolhimento, o peixe se debate na superfície com respingos, dá corridas (a faixa verde foge e a tensão sobe) e salta para fora d'água; o ponteiro tem inércia e a faixa verde encolhe nas espécies mais difíceis. Ao pegar, o peixe voa até a mão, aparece se debatendo na frente da câmera com um cartão de espécie, peso e recorde, e cai no balde, que vai enchendo (os peixes lá dentro ainda se debatem).

## Juice

Hit-stop e soco de câmera quando o tapa acerta, tranco horizontal no golpe, câmera lenta na captura, mergulho de câmera proporcional à queda ao aterrissar, FOV maior ao correr, inclinação lateral ao andar de lado, câmera tremendo com a tensão da linha e nas corridas do peixe, pulsos de aberração cromática, painel da pesca tremendo na tensão alta, brilho quando a marca está na faixa, cartão de captura com pop e sons novos (catraca do molinete na corrida, linha arrebentando, peixe caindo no balde).

## Gráficos

- Céu físico estilizado: gradiente de Rayleigh, halo de Mie, cinturão de Vênus e sombra da Terra, disco solar achatado pela refração, nuvens com iluminação direcional, cirros, estrelas, cortinas de chuva e brilho do meteoro e do impacto.
- Oceano low poly facetado: ondas direcionais com cristas afiadas (a mesma função move o barco), reflexo do céu com Fresnel, espalhamento subsuperficial nas cristas, reflexo do sol, espuma em células, esteira, espuma no casco, gotas de chuva e neblina que funde o mar ao horizonte.
- Simulação de fluido na GPU: equação de onda amortecida numa grade 256×256 (620 m), com cratera do impacto e respingos dos destroços. A frente principal da tsunami é analítica e calibrada para tocar a proa em 4:44; a simulação acrescenta os anéis caóticos. A parede tem corpo escuro, topo translúcido, estrias de espuma escorrendo, lábio que se enrola e borrifos arrancados pelo vento.
- Meteoro: rocha com crateras e rachaduras incandescentes, bainha de plasma, cauda em fitas voltadas para a câmera, fagulhas e rastro de fumaça persistente.
- Impacto: bola de fogo volumétrica que esfria em fumaça, halo, coroa d'água, domo de condensação, destroços com fogo e fumaça e cogumelo de vapor iluminado por baixo. Todas as partículas são simuladas na GPU.
- Pós-processamento HDR: bloom, aberração cromática, blur radial a partir do impacto, gradação de cor por fase, vinheta, grão e SMAA. Mapa de ambiente gerado do próprio céu, sombras suaves, lanterna de popa com luz, farol com feixe, ilhas com cores por vértice e gaivotas animadas.
- Câmera: balanço da caminhada, o horizonte inclina com o barco, assistência de olhar para o meteoro e o impacto, zoom teleobjetiva, tremores e planos de cinema na cutscene.

## Áudio

Tudo é sintetizado no navegador: mar em camadas estéreo, espuma, vento com rajadas e assobio, chuva, tábuas rangendo, gaivotas, motor de popa, passos, trovões com estalo e ribombo, crepitar e estrondo sônico do meteoro, a frente de choque (com audição abafada e zumbido), o rugido crescente da tsunami e o golpe final seguido de silêncio. A música é generativa, com violão Karplus-Strong e pads, e muda com cada fase. Efeitos do outro pescador são posicionais (HRTF) e há reverberação por convolução.

## Rostos

As fotos não são mais um plano colado na frente da cabeça: viram textura da própria malha do rosto (suavizada), por projeção frontal com máscara elíptica e pela normal. Olhos, sobrancelhas, boca e barba modelados foram removidos porque já estão na foto; o nariz modelado recebe a foto e dá relevo. A cor média da pele na foto é equilibrada com a pele do modelo, o que também remove o tom avermelhado da primeira foto.

## Desempenho

Qualidade **Alta** usa resolução até 1,5×, sombras de 2048 px, pós-processamento completo e SMAA. **Leve** reduz resolução, sombras, malhas e partículas; muda ao recarregar. Todos os shaders do clímax são compilados durante o carregamento para não travar no impacto. Não existe promessa de FPS para todo hardware.

## GitHub Pages

```powershell
npm test
npm run build
npm run preview
```

O resultado está em `dist/`, com caminhos relativos compatíveis com um repositório do Pages. Publique o **conteúdo desta pasta `jogo` como a raiz do repositório** e selecione GitHub Actions em Settings → Pages. O workflow `.github/workflows/pages.yml` testa, gera e publica em pushes na branch `main`. Nenhum repositório remoto foi criado e nenhum conteúdo foi publicado automaticamente.

O Pages serve o cliente estático, não executa um servidor de jogo. As imagens dos rostos ficam nos arquivos públicos do jogo e também nos GLBs. A publicação desses arquivos torna as fotos acessíveis aos visitantes.

## Organização

- `src/core.js`: regras, lobby, pesca, clima, ondas (CPU e GLSL), tsunami e protocolo.
- `src/main.js`: partida, primeira pessoa, rede, câmera, cutscene e HUD.
- `src/input.js`: pointer lock, mouse e teclado.
- `src/network.js`: salas PeerJS, WebRTC manual, STUN e teste em duas abas.
- `src/shaders.js`: ruídos, céu e uniformes compartilhados.
- `src/environment.js`: céu, oceano, luzes, mapa de ambiente, ilhas, farol, gaivotas, chuva e relâmpagos.
- `src/fluid.js`: simulação de fluido na GPU.
- `src/cataclysm.js`: meteoro, impacto, partículas na GPU e lábio da tsunami.
- `src/post.js`: pós-processamento.
- `src/models.js`: esqueleto, carregamento e rostos projetados.
- `src/characters.js`, `src/boat.js`, `src/fish.js`: modelos procedurais.
- `src/geometry.js`: ferramentas de modelagem (loft, membros, varredura, cores por vértice).
- `src/animation.js`: animação procedural e olhar entre personagens.
- `src/fishingfx.js`: boia, linha, peixe fisgado, voo até a mão e balde.
- `src/physics.js`: ragdolls cannon-es.
- `src/audio.js`: áudio procedural.
- `src/atelier.js`: visualizador WebGL.
- `tests/`: regras, arquivos, física e sincronia do final.

As dependências estão fixadas no lockfile. Three.js, cannon-es, PeerJS e Vite são distribuídos sob licença MIT.
