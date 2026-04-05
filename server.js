const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const ASTRO_APP_ID = process.env.ASTRO_APP_ID || process.env.astro_app_id;
const ASTRO_APP_SECRET = process.env.ASTRO_APP_SECRET || process.env.astro_app_secret || process.env.APP_SECRET || process.env.app_secret;
const IPGEO_API_KEY = process.env.IPGEO_API_KEY;

if (!ASTRO_APP_ID || !ASTRO_APP_SECRET) {
    console.error("Missing ASTRO_APP_ID or ASTRO_APP_SECRET in environment variables");
    process.exit(1);
}

if (!IPGEO_API_KEY) {
    console.warn("Warning: IPGEO_API_KEY not found in environment variables. Moon endpoint will not work.");
}

function diasVividos(nascimento) {
    const hoje = new Date();
    const inicio = new Date(nascimento);
    return Math.floor((hoje - inicio) / (1000 * 60 * 60 * 24));
}

function anosVividos(nascimento) {
    const hoje = new Date();
    const inicio = new Date(nascimento);
    let idade = hoje.getFullYear() - inicio.getFullYear();
    const m = hoje.getMonth() - inicio.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < inicio.getDate())) idade--;
    return idade;
}

function calcularCiclos(dias) {
    return {
        fisico: dias % 23,
        emocional: dias % 28,
        intelectual: dias % 33,
    };
}

function dataPorDias(nascimento, diasOffset) {
    const base = new Date(nascimento);
    base.setDate(base.getDate() + diasOffset);
    return base;
}

function classificar(tipo, valor) {
    let tipoBase = "neutro";
    let alerta = null;

    if (tipo === "fisico") {
        if (valor === 1 || valor === 12) tipoBase = "critico";
        else if (valor === 7) { tipoBase = "positivo"; alerta = "precaução mínima"; }
        else if (valor === 18) { tipoBase = "negativo"; alerta = "precaução mínima"; }
        else if (valor >= 2 && valor <= 11) tipoBase = "positivo";
        else if ((valor >= 13 && valor <= 23) || valor === 0) tipoBase = "negativo";
    }

    if (tipo === "emocional") {
        if (valor === 1 || valor === 15) tipoBase = "critico";
        else if (valor === 8) { tipoBase = "positivo"; alerta = "precaução mínima"; }
        else if (valor === 22) { tipoBase = "negativo"; alerta = "precaução mínima"; }
        else if (valor >= 2 && valor <= 14) tipoBase = "positivo";
        else if ((valor >= 16 && valor <= 28) || valor === 0) tipoBase = "negativo";
    }

    if (tipo === "intelectual") {
        if (valor === 1 || valor === 17) tipoBase = "critico";
        else if (valor === 9 || valor === 16) { tipoBase = "positivo"; alerta = "precaução mínima"; }
        else if (valor >= 2 && valor <= 16) tipoBase = "positivo";
        else if ((valor >= 18 && valor <= 33) || valor === 0) tipoBase = "negativo";
    }

    return {
        tipo: tipoBase,
        alerta
    };
}

const planetas = ["Sol", "Lua", "Marte", "Mercúrio", "Júpiter", "Vênus", "Saturno"];
const correspondencias = {
    "Sol": { nota: "Lá" },
    "Lua": { nota: "Ré" },
    "Marte": { nota: "Sol" },
    "Mercúrio": { nota: "Dó" },
    "Júpiter": { nota: "Fá" },
    "Vênus": { nota: "Si" },
    "Saturno": { nota: "Mi" },
};

app.post("/calcular", (req, res) => {
    const { nascimento, nome } = req.body;

    if (!nascimento || isNaN(new Date(nascimento).getTime())) {
        console.log("Invalid nascimento");
        return res.status(400).json({ error: "Data de nascimento inválida" });
    }

    const hoje = new Date();

    const dias = diasVividos(nascimento);
    const anos = anosVividos(nascimento);
    const ciclos = calcularCiclos(dias);

    const diaSemana = hoje.getDay();
    const hora = hoje.getHours();

    const planetaDia = planetas[diaSemana];
    const notaDia = correspondencias[planetaDia]?.nota || "-";

    const planetaHora = planetas[hora % 7];
    const notaHora = correspondencias[planetaHora]?.nota || "-";

    const grafico = [];

    for (let a = 0; a <= 30; a++) {
        const diasOffset = dias + a;

        const dataRef = new Date(nascimento);
        dataRef.setDate(dataRef.getDate() + diasOffset);

        const fisico = diasOffset % 23;
        const emocional = diasOffset % 28;
        const intelectual = diasOffset % 33;

        const f = classificar("fisico", fisico);
        const e = classificar("emocional", emocional);
        const i = classificar("intelectual", intelectual);
        grafico.push({
            dia: a,
            data: dataRef.toLocaleDateString("pt-BR"),
            fisico,
            emocional,
            intelectual,
            status: {
                fisico: f,
                emocional: e,
                intelectual: i
            },
            alerta: [f, e, i].some(x => x.tipo === "critico"),
        });

    }

    const insight = {
        fisico: classificar("fisico", ciclos.fisico),
        emocional: classificar("emocional", ciclos.emocional),
        intelectual: classificar("intelectual", ciclos.intelectual),
    };

    res.json({
        nome,
        diasVividos: dias,
        anosVividos: anos,
        diaSemana: hoje.toLocaleDateString("pt-BR", { weekday: "long" }),
        ciclos,
        insight,
        planetaDia,
        notaDia,
        planetaHora,
        notaHora,
        hora,
        minuto: hoje.getMinutes(),
        grafico,
    });

});

app.get("/ceu", async (req, res) => {
    try {
        const lat = -23.55; // São Paulo
        const lon = -46.63;

        const agora = new Date();
        const date = agora.toISOString().split("T")[0];
        const time = agora.toTimeString().split(" ")[0];

        const response = await axios.get(
            "https://api.astronomyapi.com/api/v2/bodies/positions",
            {
                headers: {
                    'app_id': ASTRO_APP_ID,
                    'app_secret': ASTRO_APP_SECRET,
                },
                params: {
                    latitude: lat,
                    longitude: lon,
                    elevation: 0,
                    from_date: date,
                    to_date: date,
                    time: time,
                },
            }
        );

        const rows = response.data.data.table.rows;
        // 🔎 pegar só planetas
        const planetas = rows.filter((r) =>
            [
                "Mercury",
                "Venus",
                "Mars",
                "Jupiter",
                "Saturn",
                "Uranus",
                "Neptune",
                "Pluto",
            ].includes(r.entry.name)
        );

        // 🌌 filtrar visíveis (acima do horizonte)
        const visiveis = planetas
            .filter((p) => p.cells[0].position.altitude.degrees > 0)
            .map((p) => ({
                nome: p.entry.name,
                altitude: p.cells[0].position.altitude.degrees.toFixed(2),
            }));

        res.json({
            visiveis,
            total: visiveis.length,
            timestamp: agora,
        });

    } catch (error) {
        console.error("Erro API:", error.response?.data || error.message);
        res.status(500).json({ error: "Erro ao buscar céu atual" });
    }
});

app.get("/lua", async (req, res) => {
    try {
        if (!IPGEO_API_KEY) {
            return res.status(500).json({ error: "API key não configurada" });
        }

        const response = await axios.get(
            "https://api.ipgeolocation.io/v3/astronomy",
            {
                params: {
                    apiKey: IPGEO_API_KEY,
                    lat: -23.55,
                    long: -46.63,
                    date: new Date().toISOString().split("T")[0],
                    timezone: "America/Sao_Paulo"
                },
            }
        );

        const moon = response.data.astronomy;

        res.json({
            fase: moon.moon_phase,                    // ex: WANING_GIBBOUS
            iluminacao: parseFloat(moon.moon_illumination_percentage) / 100, // normalizar para 0-1
            idade: "não disponível",                 // IPGeolocation não fornece idade da lua
            moonrise: moon.moonrise,                 // ex: 22:53
            moonset: moon.moonset,                   // ex: 07:59
            moon_altitude: moon.moon_altitude,       // altitude acima do horizonte
            moon_distance: moon.moon_distance,       // distância em km
        });

    } catch (error) {
        console.error("Erro Lua:", error.response?.data || error.message);
        res.status(500).json({ error: "Erro ao buscar fase da lua" });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));