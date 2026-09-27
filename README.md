# Entre peixes e Notas

Pescaria cooperativa em **primeira pessoa** para **2 a 4 jogadores**, em WebGL/Three.js. A partida começa atracada no cais de uma vila de pescadores. A tripulação pesca, vende o pescado no supermercado da ilha e defende o balde das gaivotas ladras. O jogo não acaba sozinho: o fim do mundo só começa quando o anfitrião aperta **TAB**. O modo de um jogador existe para testar os sistemas. Os rostos usam as fotos originais como textura projetada na malha da cabeça.

## Rodar

Requer Node.js 24.

```powershell
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. **Testar sozinho** inicia o teste solo. O jogo precisa de servidor HTTP: abrir `index.html` direto como arquivo não funciona. `atelier.html` é o visualizador dos modelos: personagens, barco, rifle, gaivota, padeiro, todos os pescados e uma prévia da primeira pessoa (com botões de atirar, recarregar e mirar).

## Controles

| Ação | Controle |
| --- | --- |
| Olhar ao redor | Mouse (clique na tela para capturar o cursor) |
| Andar / acelerar e virar no leme | WASD ou setas |
| Correr · segurar a respiração na luneta | Shift |
| Pular | Espaço |
| Dar um tapa · mirar com a luneta (com rifle) | Botão direito |
| Atirar (com rifle) | Botão esquerdo |
| Leme · pegar/devolver rifle · vender na peixaria | E |
| Lançar, fisgar e recolher (segurar) | F |
| Chamar o meteoro (só o anfitrião, duas vezes seguidas) | TAB |
| Liberar o cursor e abrir as opções | Esc |

## A ilha

No centro do mapa há uma vila no estilo açoriano do litoral catarinense:

- cais de madeira com estacas, cabeços de amarração, lampiões, boia salva-vidas e o pórtico "Porto da Vila";
- calçadão de pedra portuguesa com guarda-corpo, escadas para a areia e quiosque de água de coco;
- rua de paralelepípedo com calçadas, orelhão, postes coloniais e dez casas coloridas, com venezianas, floreiras, cercas e buganvílias;
- praça com chafariz e ipês-amarelos, e uma igrejinha com torre sineira;
- praia com coqueiros, guarda-sóis, canoas e ranchos de pesca;
- morro com araucárias e o farol.

A vegetação e a grama balançam com o vento, que fica mais forte na tempestade. No shader do mar, o fundo da ilha deixa a água rasa turquesa, e as marolas correm para a praia e quebram com espuma.

O **supermercado** é inspirado nas lojas Althoff: paredes amarelo-limão, faixa de telha metálica ondulada azul, oval amarelo com o logo, marquise branca, totem na praça, carrinhos e portas automáticas. Por dentro há:

- gôndolas cheias, hortifrúti, geladeiras de frios e uma pirâmide de latas de Baly;
- a **peixaria**, onde se vende o balde inteiro com **E** (o barco precisa estar atracado, porque o balde fica nele);
- a **padaria**, com "O pescador" trabalhando de padeiro — dá para dar um tapa nele: ele vira ragdoll, levanta e volta andando ao balcão;
- quatro **caixas de autoatendimento** sem operador (a compra de itens entra numa próxima versão).

Andar pela borda do barco não derruba mais ninguém na água: a borda é uma parede. Só se passa para o cais ou para a praia quando há chão firme ao lado. Os ragdolls sempre reaparecem no barco. O barco colide com a ilha e com o cais.

## Pesca

São 25 coisas na linha, em raridades **comum, incomum, rara, épica e lendária**:

- **Peixes:** sardinha, tainha, corvina, pargo-rosa, linguado, robalo, baiacu, peixe-espada, garoupa, arraia, dourado, atum-azul e marlim-azul.
- **Tesouros:** moeda antiga, relógio de ouro, anel de noivado, garrafa com mensagem e baú.
- **Lixo:** bota, pneu, lata, sacola, alga, sunga perdida e controle remoto.
- **Especial:** a **lata de BALY** (rótulo preto e amarelo do Baly Tradicional), que dá 30 segundos de velocidade em tudo — andar, pular, recolher a linha e atirar. Durante o efeito, a tela fica frenética: matiz girando, pulso na batida, linhas de velocidade e uma batida eletrônica.

O minigame mostra a raridade de quem está na linha. Manter a marca na faixa verde enche um **combo** que acelera o progresso. A interface tem o "!" gigante da fisgada, cartão de captura com raios na cor da raridade, confete, valor em reais e "novo recorde" ou "novo no álbum". A venda solta moedas e o contador de dinheiro vai rolando.

## Rifles e gaivotas

Dois rifles de ferrolho ficam no suporte do barco. O modelo tem peças que se movem: o ferrolho gira e corre, o carregador é destacável, e há luneta com torres, anéis, lentes e bandoleira. Em primeira pessoa, as duas mãos seguram a arma (IK de dois ossos): uma no punho, outra no guarda-mão. Depois de cada tiro a mão direita manobra o ferrolho e a cápsula é ejetada. A recarga é animada:

1. a arma gira;
2. o carregador cai;
3. a mão busca outro e o encaixa com um tapa;
4. o ferrolho é manobrado.

O tiro tem estalo, estrondo, cauda e ecos na água, além de clarão em estrela, fumaça e luz. A luneta aproxima 5x, tem retículo duplex e reduz a sensibilidade do mouse; a respiração balança a mira e Shift a segura. Em terceira pessoa, os outros veem a coronha no ombro e as duas mãos por IK. O rifle é desenhado numa camada própria e nunca atravessa paredes.

As gaivotas circulam bem alto e **não podem ser atingidas** enquanto circulam. Só a **ladra** pode: ela é marcada na tela (com seta na borda quando está fora de vista), mergulha em direção ao balde, paira pegando o peixe e foge devagar, pesada, carregando o peixe. Se for abatida sobre o barco, o peixe volta para o balde. Na tempestade elas não atacam.

## O fim

O clima alterna calmaria e tempestade indefinidamente. Quando o anfitrião aperta TAB (duas vezes, para não acontecer sem querer), todos recebem o aviso. O céu vira tempestade vermelha, o meteoro vem por cima do barco e cai no meio da ilha. Tudo vai pelos ares: casas, a igreja, o farol, painéis do mercado, árvores, tábuas do cais e pedaços de terra com grama, que caem no mar levantando respingos. No lugar fica uma cratera submersa. Quem estiver em terra voa junto. Depois vêm a tsunami, a cutscene dos dois primeiros personagens e o apagão sincronizado com a onda.

## Multiplayer

O anfitrião é a autoridade sobre barco, pesca, gaivotas, venda, padeiro, tapas e relógio. Cada jogador controla o próprio movimento (no barco ou em terra) com predição local.

- **Sala com código:** um jogador cria a sala e passa o código de 5 letras; até 3 amigos entram com ele.
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
- `src/main.js`: partida, movimento barco/terra, rede, câmera, cutscene e HUD.
- `src/fish.js`, `src/characters.js`, `src/boat.js`: modelos procedurais.
- `src/environment.js`, `src/cataclysm.js`, `src/fluid.js`, `src/post.js`, `src/shaders.js`: céu, mar, meteoro, fluido e pós-processamento.
- `src/animation.js`: animação procedural, IK dos braços e olhar entre personagens.
- `src/physics.js`: ragdolls (barco, ilha e padeiro).
- `src/audio.js`: áudio procedural.
- `tests/`: regras, ilha, pesca, gaivotas, física e sincronia do final.
