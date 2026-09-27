# Entre peixes e Notas

Pescaria cooperativa em **primeira pessoa** para **2 a 5 jogadores**, em WebGL/Three.js. A partida começa com o barco amarrado no cais de Laguna, uma vila de pescadores. A tripulação pesca, carrega o balde até o supermercado para vender, defende o pescado das gaivotas ladras, toca violão e resgata quem cai no mar com a corda do barco. O jogo não acaba sozinho: o fim do mundo só começa quando o anfitrião aperta **TAB**. O modo de um jogador existe para testar os sistemas. Os rostos usam as fotos originais como textura projetada na malha da cabeça.

## Rodar

Requer Node.js 24.

```powershell
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. **Testar sozinho** inicia o teste solo. O jogo precisa de servidor HTTP: abrir `index.html` direto como arquivo não funciona. `atelier.html` é o visualizador dos modelos: os cinco personagens, barco, rifle, gaivota, padeiro, todos os pescados, os 20 moradores e uma prévia da primeira pessoa (com botões de atirar, recarregar e mirar). Para testar direto no jogo, abra `/?teste` (teste solo sem menu).

## Controles

| Ação | Controle |
| --- | --- |
| Olhar ao redor | Mouse (clique na tela para capturar o cursor) |
| Andar / acelerar e virar no leme | WASD ou setas |
| Correr · segurar a respiração na luneta | Shift |
| Pular | Espaço |
| Dar um tapa · mirar com a luneta (com rifle) | Botão direito |
| Atirar (com rifle) | Botão esquerdo |
| Usar o que está na mira (leme, rifle, balde, corda, violão, peixaria, padeiro, caixas): o aviso "E" aparece em cima do objeto · largar o que está na mão | E |
| Girar o laço e soltar (com a corda) | Botão esquerdo, duas vezes |
| Tocar o violão | D F J K |
| Espantar a gaivota que agarrou o balde (segurar) | F |
| Lançar, fisgar e recolher (segurar) | F |
| Tela de eventos (só o anfitrião, segurar): tempestade, Nessie, meteoro | TAB |
| Liberar o cursor e abrir as opções | Esc |

## A ilha

No centro do mapa fica **Laguna**, uma vila no estilo açoriano do litoral catarinense:

- cais de madeira com estacas, cabeços de amarração, lampiões, boia salva-vidas e o pórtico "Laguna";
- calçadão de pedra portuguesa com guarda-corpo, escadas para a areia e quiosque de água de coco;
- rua de paralelepípedo com calçadas, orelhão, postes coloniais e casas coloridas, com venezianas, floreiras, cercas e buganvílias;
- a travessa da Figueira, à esquerda do mercado, com mais cinco casas;
- praça com chafariz e ipês-amarelos, e uma igrejinha com torre sineira;
- praia com coqueiros, guarda-sóis, canoas e ranchos de pesca;
- morro com araucárias e o farol, com lente de Fresnel girando, dois fachos com poeira no ar, clarão quando o facho passa por quem olha e um holofote que varre o mar;
- 20 moradores (dá para dar tapa neles: viram ragdoll e voltam ao caminho) com roupas, chapéus (palha, pescador, gorro, panamá, boné) e acessórios variados, andando pelas ruas, pelo calçadão, pela praça e pelo cais. O caminho de cada um sai do relógio da partida, então todos os jogadores veem as mesmas pessoas no mesmo lugar. Os rostos são retratos pintados no próprio jogo. Mais tarde eles vão dar missões.

A vegetação e a grama balançam com o vento, que fica mais forte na tempestade. No shader do mar, o fundo da ilha deixa a água rasa turquesa, e as marolas correm para a praia e quebram com espuma.

O **supermercado** é inspirado nas lojas Althoff: paredes amarelo-limão, faixa de telha metálica ondulada azul, oval amarelo com o logo, marquise branca, totem na praça, carrinhos e portas automáticas. Por dentro há:

- gôndolas cheias, hortifrúti, geladeiras de frios e uma pirâmide de latas de Baly;
- a **peixaria**, onde se vende o balde inteiro com **E**. O balde precisa estar ali: alguém pega o balde no barco (E) e carrega até a peixaria;
- a **padaria**, com "O pescador" trabalhando de padeiro. Com **E**, ele diz "É... Tenho que sair aqui" (todos por perto veem o diálogo sendo digitado) e some numa nuvem de fumaça, com o som de quem sai da chamada. Dez segundos depois ele volta pela porta da loja. O tapa ainda funciona: ele vira ragdoll, levanta e volta andando ao balcão;
- quatro **caixas de autoatendimento** sem operador (a compra de itens entra numa próxima versão).

Andar pela borda do barco não derruba ninguém na água: a borda é uma parede. Só se passa para o cais ou para a praia quando há chão firme ao lado. O barco colide com a ilha e com o cais.

## Corda, deriva e resgate

- **Deriva:** sem ninguém no leme e sem corda, o barco anda sozinho com o mar. Na tempestade ele vai longe.
- **Atracar:** a corda fica enrolada na proa. Com ela na mão, mire num cabeço do cais e clique: o laço começa a girar sobre a cabeça. Clique de novo quando o laço estiver na frente (faixa verde). Quanto mais longe, menor a faixa, até o limite de 24 m. Acertando, a corda voa em arco e amarra no cabeço, com física de corda. **E** no cunho da proa ou no cabeço solta de novo.
- **Morrer e reviver:** o tapa só derruba, e a pessoa levanta onde caiu. Cair no mar é o que conta: o corpo ainda voa no primeiro contato com a água e depois fica boiando. Quem está à deriva tem **20 segundos** (barra na tela) para ser laçado com o mesmo minigame da corda. Laçado, é puxado até quem segura a corda e levanta no barco. Se ninguém laçar a tempo, acorda no cais de Laguna.

## Pesca

São 25 coisas na linha, em raridades **comum, incomum, rara, épica e lendária**:

- **Peixes:** sardinha, tainha, corvina, pargo-rosa, linguado, robalo, baiacu, peixe-espada, garoupa, arraia, dourado, atum-azul e marlim-azul.
- **Tesouros:** moeda antiga, relógio de ouro, anel de noivado, garrafa com mensagem e baú.
- **Lixo:** bota, pneu, lata, sacola, alga, sunga perdida e controle remoto.
- **Especial:** a **lata de BALY** (rótulo preto e amarelo do Baly Tradicional), que dá 30 segundos de velocidade em tudo — andar, pular, recolher a linha e atirar. Durante o efeito, a tela fica frenética: matiz girando, pulso na batida, linhas de velocidade e uma batida eletrônica.

O minigame mostra a raridade de quem está na linha. Manter a marca na faixa verde enche um **combo** que acelera o progresso. A interface tem o "!" gigante da fisgada, cartão de captura com raios na cor da raridade, confete, valor em reais e "novo recorde" ou "novo no álbum". A venda solta moedas e o contador de dinheiro vai rolando.

## Balde e gaivotas no cabo de guerra

O balde é uma peça solta: fica no convés, na mão de alguém ou no chão. Largado no chão, ele ganha um marcador amarelo na tela (com a distância), como o das gaivotas. As gaivotas vão atrás dele onde estiver. Se uma gaivota agarrar o balde enquanto alguém o segura, começa um cabo de guerra: segure **F** para manter a marca numa faixa que foge o tempo todo, antes que a garra da gaivota encha. É difícil de propósito. Os amigos podem atirar nela durante a briga, e o rifle continua sendo a melhor arma.

## Violão

O violão fica no banco do meio do barco. Com **E**, quem pega vira a banda da partida: a trilha automática saiu, e a música agora é o que alguém toca. Primeiro aparece a lista de músicas (**W/S** escolhe, **ENTER** toca, **Q** volta à lista), cada uma marcada como **fácil, médio, difícil ou extremo**. São quatro trilhas (D F J K) com notas caindo numa estrada em perspectiva, janela de acerto folgada, combo, multiplicador até x4 (as bordas da estrada acendem), explosões nos acertos e avisos de combo. No fim, a nota em estrelas fica guardada na lista.

- **Fácil:** Brilha, Brilha, Estrelinha · Rema, Rema, Remador (Row, Row, Row Your Boat) · Frère Jacques · Canção do Pescador (original)
- **Médio:** Ode à Alegria (Beethoven) · Meu Bem Está Além do Mar (My Bonnie) · O Marinheiro Bêbado (Drunken Sailor, cantiga de marinheiro e pirata)
- **Difícil:** Scarborough Fair · Greensleeves · Saque em Laguna (shanty de pirata original)
- **Extremo:** Laguna ao Entardecer (original) · No Salão do Rei da Montanha (Grieg, acelera até o fim) · Cavalgada das Valquírias (Wagner, mitologia nórdica)

Todas são de domínio público ou composições do jogo; músicas de filmes e séries (como as de piratas e vikings famosas) têm direitos autorais e ficaram de fora. O som é posicional: quem está perto ouve bem, e quem está longe ouve cada vez menos. Nas opções há volume do jogo, volume da música (violão) e sensibilidade do mouse.

## Rifles e gaivotas

Dois rifles de ferrolho ficam no suporte do barco. O modelo tem peças que se movem: o ferrolho gira e corre, o carregador é destacável, e há luneta com torres, anéis, lentes e bandoleira. Em primeira pessoa, as duas mãos seguram a arma (IK de dois ossos): uma no punho, outra no guarda-mão. Depois de cada tiro a mão direita manobra o ferrolho e a cápsula é ejetada. A recarga é animada:

1. a arma gira;
2. o carregador cai;
3. a mão busca outro e o encaixa com um tapa;
4. o ferrolho é manobrado.

O tiro tem estalo, estrondo, cauda e ecos na água, além de clarão em estrela, fumaça e luz. A luneta aproxima 5x, tem retículo duplex e reduz a sensibilidade do mouse; a respiração balança a mira e Shift a segura. Em terceira pessoa, os outros veem a coronha no ombro e as duas mãos por IK. O rifle é desenhado numa camada própria e nunca atravessa paredes.

As gaivotas circulam bem alto e **não podem ser atingidas** enquanto circulam. Só a **ladra** pode: ela é marcada na tela (com seta na borda quando está fora de vista), mergulha em direção ao balde, paira pegando o peixe e foge devagar, pesada, carregando o peixe. Se for abatida sobre o barco, o peixe volta para o balde. Na tempestade elas não atacam.

## Eventos (TAB)

Nada acontece sozinho: o clima fica calmo até o anfitrião segurar **TAB** e escolher um evento.

- **Tempestade:** vento, chuva, raios e ondas grandes por uns 2 minutos (clique de novo para acalmar).
- **Nessie:** a Matriarca do Abismo desperta em mar aberto quando o barco se afasta da ilha. São três estágios (A Espreita, A Fúria e A Matriarca Ferida, com céu vermelho e olhos em brasa), 3.000 de vida e nove ataques sem aviso: investidas, golpe de cauda, jato d'água, redemoinho, mordida de baixo para cima, muralha d'água e chuva de espinhos. Os rifles são a arma: olhos ×5, garganta ×3, guelras ×2, corpo ×1 e espinhos ×0,25. Os golpes jogam a tripulação no mar (resgate com a corda). Vencer rende R$ 1.000. O ateliê mostra a luta inteira em funcionamento.
- **Meteoro:** o fim da partida.

## O fim

O clima alterna calmaria e tempestade indefinidamente. Quando o anfitrião aperta TAB (duas vezes, para não acontecer sem querer), todos recebem o aviso. O céu vira tempestade vermelha, o meteoro vem por cima do barco e cai no meio da ilha. Tudo vai pelos ares: casas, a igreja, o farol, painéis do mercado, árvores, tábuas do cais e pedaços de terra com grama, que caem no mar levantando respingos. No lugar fica uma cratera submersa. Quem estiver em terra voa junto. Depois vêm a tsunami, a cutscene dos dois primeiros personagens e o apagão sincronizado com a onda.

## Multiplayer

O anfitrião é a autoridade sobre barco, pesca, gaivotas, venda, padeiro, tapas e relógio. Cada jogador controla o próprio movimento (no barco ou em terra) com predição local.

- **Sala com código:** um jogador cria a sala e passa o código de 5 letras; até 4 amigos entram com ele.
- **Conexão manual:** para 2 jogadores, sem servidor de salas.
- **Duas abas:** teste local no mesmo navegador.

A sinalização usa o servidor público do PeerJS e os dados vão direto entre os navegadores (WebRTC com STUN). **Não há servidor TURN**, então redes restritivas podem não conectar: 4G/5G com CGNAT, Wi‑Fi de empresa ou de faculdade. Nesse caso, o convidado agora vê uma mensagem explicando o motivo. Trocar de rede ou pedir para outra pessoa criar a sala costuma resolver. Para funcionar em qualquer rede, seria preciso configurar um servidor TURN.

## Desempenho

Qualidade **Alta** usa resolução até 1,5×, sombras de 2048 px que acompanham o jogador, pós-processamento completo e SMAA. **Leve** reduz resolução, sombras, grama e partículas. Os shaders do clímax são compilados no carregamento.

## GitHub Pages

```powershell
npm test
npm run build
```

O workflow `.github/workflows/pages.yml` testa, gera e publica a cada push na branch `main`. As fotos dos rostos ficam públicas no site.

## Organização

- `src/core.js`: regras, lobby, pesca (combo e Baly), tempo de história, clima, ondas e protocolo.
- `src/catalog.js`: tudo o que pode ser pescado (raridade, valor, peso).
- `src/terrain.js`: altura da ilha, cais, lotes, mercado e chão caminhável.
- `src/island.js`: terreno, vila, cais, vegetação com vento, grama, farol e a explosão da ilha.
- `src/shop.js`: supermercado (fachada, gôndolas, peixaria, padaria, caixas).
- `src/weapons.js`: rifle, braços em primeira pessoa, recarga, luneta e traçante.
- `src/gulls.js`: gaivotas ladras.
- `src/main.js`: partida, movimento barco/terra, itens (balde, corda, violão), resgate, padeiro, rede, câmera, cutscene e HUD.
- `src/rope.js`: corda com física de Verlet (laço, arremesso, amarração, resgate).
- `src/guitar.js`: minigame do violão e as músicas.
- `src/npcs.js`: moradores de Laguna e os retratos pintados.
- `src/fish.js`, `src/characters.js`, `src/boat.js`: modelos procedurais.
- `src/environment.js`, `src/cataclysm.js`, `src/fluid.js`, `src/post.js`, `src/shaders.js`: céu, mar, meteoro, fluido e pós-processamento.
- `src/animation.js`: animação procedural, IK dos braços e olhar entre personagens.
- `src/physics.js`: ragdolls (barco, ilha e padeiro).
- `src/audio.js`: áudio procedural.
- `tests/`: regras, ilha, pesca, gaivotas, física e sincronia do final.
