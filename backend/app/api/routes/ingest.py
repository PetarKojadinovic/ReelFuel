import uuid
from typing import Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db, IngestJob, Recipe, Exercise
from app.services.ingest_pipeline import run_ingest

router = APIRouter()

# Dozvoljeni izvori - sprecava da server preuzima proizvoljne adrese
ALLOWED_HOSTS = ("instagram.com", "tiktok.com")


def _host_ok(url: str) -> bool:
    p = urlparse(url.strip())
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    h = p.hostname.lower()
    return any(h == d or h.endswith("." + d) for d in ALLOWED_HOSTS)


def _normalize(url: str) -> str:
    p = urlparse(url.strip())
    return f"{p.hostname.lower()}{p.path.rstrip('/')}"


class IngestRequest(BaseModel):
    url: str
    tip: Optional[Literal["recept", "vezba"]] = None


class SaveRequest(BaseModel):
    rezultat: Optional[dict] = None


@router.post("/")
def start(req: IngestRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    if not _host_ok(req.url):
        raise HTTPException(status_code=400, detail="Podržani su samo Instagram i TikTok linkovi")

    norm = _normalize(req.url)
    if not req.tip:
        done = (
            db.query(IngestJob)
            .filter(IngestJob.url_norm == norm, IngestJob.status == "gotovo")
            .order_by(IngestJob.created_at.desc())
            .first()
        )
        if done:
            return {"job_id": done.id, "status": "gotovo"}

    job = IngestJob(id=uuid.uuid4().hex, url=req.url.strip(), url_norm=norm, status="u_toku", faza="U redu čeka")
    db.add(job)
    db.commit()
    background.add_task(run_ingest, job.id, job.url, req.tip)
    return {"job_id": job.id, "status": "u_toku"}


@router.get("/{job_id}")
def status(job_id: str, db: Session = Depends(get_db)):
    job = db.get(IngestJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Posao nije pronađen")
    return {
        "status": job.status,
        "faza": job.faza,
        "tip": job.tip,
        "rezultat": job.rezultat,
        "greska": job.greska,
        "sacuvano_id": job.sacuvano_id,
    }


@router.post("/{job_id}/save")
def save(job_id: str, req: SaveRequest, db: Session = Depends(get_db)):
    job = db.get(IngestJob, job_id)
    if not job or job.status != "gotovo":
        raise HTTPException(status_code=400, detail="Rezultat još nije spreman")
    if job.sacuvano_id:
        return {"tip": job.tip, "id": job.sacuvano_id}

    data = req.rezultat or job.rezultat or {}
    if job.tip == "recept":
        obj = Recipe(
            naziv_jela=data.get("naziv_jela") or "Recept bez naziva",
            sastojci=data.get("sastojci") or [],
            koraci=data.get("koraci") or [],
            priblizne_kalorije=data.get("priblizne_kalorije"),
            source_url=job.url,
        )
    else:
        obj = Exercise(
            naziv_vezbe=data.get("naziv_vezbe"),
            grupa_misica=data.get("grupa_misica"),
            serije_i_ponavljanja=data.get("serije_i_ponavljanja"),
            detektovano_ponavljanja=data.get("detektovano_ponavljanja"),
            source_url=job.url,
        )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    job.sacuvano_id = obj.id
    db.commit()
    return {"tip": job.tip, "id": obj.id}