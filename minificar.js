const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const jsDir = path.join(__dirname, "js");
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith(".js"));

console.log("Iniciando ofuscação dos arquivos JS...");

files.forEach((file) => {
  const filePath = path.join(jsDir, file);
  console.log(`Minificando e ofuscando: ${file}`);

  // Executa o Terser: -c (comprime), -m (ofusca nomes), --module (protege os 'imports' e 'exports')
  execSync(`npx terser "${filePath}" -o "${filePath}" -c -m --module`);
});

console.log(
  "\n✅ Sucesso! Todo o código JavaScript foi preparado para produção.",
);
