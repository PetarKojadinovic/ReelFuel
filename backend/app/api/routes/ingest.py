import uuid
from typing import Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.url_guard import GRESKA, host_ok
from app.models.database import get_db, IngestJob, Recipe, Exercise
from app.services.ingest_pipeline import run_ingest

router = APIRouter()


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
    if not host_ok(req.url):
        raise HTTPException(status_code=400, detail=GRESKA)

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


# Statusi koji se prikazuju u listi "Spremno za pregled"
PREGLED_STATUSI = ("u_toku", "gotovo", "potrebna_odluka", "greska")


def _naziv(job: IngestJob) -> Optional[str]:
    r = job.rezultat or {}
    return r.get("naziv_jela") or r.get("naziv_vezbe")


@router.get("/")
def pregled(db: Session = Depends(get_db)):
    """Sve sto je obrada vratila, a korisnik jos nije sacuvao ni odbacio."""
    jobs = (
        db.query(IngestJob)
        .filter(IngestJob.status.in_(PREGLED_STATUSI), IngestJob.sacuvano_id.is_(None))
        .order_by(IngestJob.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "stavke": [
            {
                "id": j.id,
                "url": j.url,
                "status": j.status,
                "faza": j.faza,
                "tip": j.tip,
                "naziv": _naziv(j),
                "greska": j.greska,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ]
    }


@router.post("/{job_id}/odbaci")
def odbaci(job_id: str, db: Session = Depends(get_db)):
    job = db.get(IngestJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Posao nije pronađen")
    if job.status == "u_toku":
        raise HTTPException(status_code=400, detail="Obrada još traje")
    if not job.sacuvano_id:
        job.status = "odbaceno"
        db.commit()
    return {"ok": True}


@router.get("/{job_id}")
def status(job_id: str, db: Session = Depends(get_db)):
    job = db.get(IngestJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Posao nije pronađen")
    return {
        "url": job.url,
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