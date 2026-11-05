"""Unos obroka glasom/opisom: parsiranje LLM odgovora i provere snimka (bez pravog LLM-a i Whisper-a)."""
import io
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile

from app.api.routes import dan
from app.services import glas_obrok


class _LazniKlijent:
    def __init__(self, odgovor):
        self.odgovor = odgovor
        self.messages = self
        self.pozvan = False

    def create(self, **kw):
        self.pozvan = True
        return SimpleNamespace(content=[SimpleNamespace(text=self.odgovor)])


def _llm(monkeypatch, data):
    k = _LazniKlijent(data if isinstance(data, str) else json.dumps(data))
    monkeypatch.setattr(glas_obrok, "client", k)
    return k


def test_opis_sabira_stavke(monkeypatch):
    _llm(monkeypatch, {
        "naziv_obroka": "Jaja i hleb",
        "stavke": [
            {"naziv": "2 jaja", "kalorije": 155, "proteini_g": 13},
            {"naziv": "parče hleba", "kalorije": 80, "proteini_g": 2.7},
        ],
    })
    r = glas_obrok.proceni_opis("pojeo sam dva jaja i parče hleba")
    assert r["naziv"] == "Jaja i hleb"
    assert r["kalorije"] == 235
    assert r["proteini_g"] == 15.7
    assert len(r["stavke"]) == 2


def test_opis_sa_json_ogradom_i_losim_stavkama(monkeypatch):
    _llm(monkeypatch, '```json\n{"naziv_obroka": null, "stavke": [{"naziv": "jabuka", "kalorije": "95"},'
                      ' {"naziv": "", "kalorije": 10}, {"naziv": "x", "kalorije": "puno"}]}\n```')
    r = glas_obrok.proceni_opis("jabuka")
    assert r["naziv"] == "jabuka"
    assert r["kalorije"] == 95
    assert r["proteini_g"] is None  # bar jedna stavka bez proteina -> zbir nepoznat
    assert len(r["stavke"]) == 1


def test_bez_hrane(monkeypatch):
    _llm(monkeypatch, {"naziv_obroka": None, "stavke": []})
    r = glas_obrok.proceni_opis("kakvo je vreme")
    assert r["naziv"] is None and r["kalorije"] is None and r["stavke"] == []


def test_prazan_tekst_ne_zove_llm(monkeypatch):
    k = _llm(monkeypatch, {})
    r = glas_obrok.proceni_opis("   ")
    assert r["stavke"] == [] and not k.pozvan


def _upload(sadrzaj: bytes, ime: str) -> UploadFile:
    return UploadFile(file=io.BytesIO(sadrzaj), filename=ime)


def test_glas_odbija_los_format():
    with pytest.raises(HTTPException) as e:
        dan.glas_obroka(_upload(b"abc", "snimak.exe"))
    assert e.value.status_code == 400


def test_glas_odbija_prazan_i_prevelik(monkeypatch):
    with pytest.raises(HTTPException) as e:
        dan.glas_obroka(_upload(b"", "snimak.m4a"))
    assert e.value.status_code == 400
    monkeypatch.setattr(dan, "MAX_SNIMAK", 10)
    with pytest.raises(HTTPException) as e:
        dan.glas_obroka(_upload(b"x" * 11, "snimak.m4a"))
    assert e.value.status_code == 413


def test_glas_prosledjuje_snimak(monkeypatch):
    primljeno = {}

    def lazno(sadrzaj, ext):
        primljeno.update(sadrzaj=sadrzaj, ext=ext)
        return {"tekst": "jabuka", "naziv": "Jabuka", "kalorije": 95, "proteini_g": 0.5, "stavke": []}

    monkeypatch.setattr(dan, "proceni_snimak", lazno)
    r = dan.glas_obroka(_upload(b"audio", "rec.M4A"))
    assert r["kalorije"] == 95
    assert primljeno == {"sadrzaj": b"audio", "ext": ".m4a"}
