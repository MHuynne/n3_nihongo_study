from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

StudyCategory = Literal[
    "Từ vựng bài học",
    "Từ vựng bài đọc",
    "Từ vựng bài nghe",
    "Hán tự",
    "Ngữ pháp",
]
SafeId = Annotated[str, StringConstraints(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]


class StudyItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    term: str = Field(max_length=500)
    meaning: str = Field(max_length=4000)
    lesson: str = Field(min_length=1, max_length=200)
    category: StudyCategory
    reading: str = Field(default="", max_length=4000)
    hanviet: str = Field(default="", max_length=4000)
    example: str = Field(default="", max_length=4000)
    translation: str = Field(default="", max_length=4000)
    structure: str = Field(default="", max_length=4000)
    usage: str = Field(default="", max_length=4000)
    context: str = Field(default="", max_length=4000)
    jlpt_note: str = Field(default="", max_length=4000)
    study_note: str = Field(default="", max_length=4000)
    deck_folder: str = Field(default="", max_length=120)
    deck_name: str = Field(default="", max_length=200)


class ReviewProgress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weak: bool | None = None
    level: int | None = Field(default=None, ge=0, le=5)
    due: int | float | None = Field(default=None, ge=0, le=9_999_999_999_999)


class StudyNote(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    lesson: str = Field(default="", max_length=200)
    term: str = Field(default="", max_length=4000)
    reading: str = Field(default="", max_length=4000)
    hanviet: str = Field(default="", max_length=4000)
    meaning: str = Field(default="", max_length=4000)
    time: str = Field(default="", max_length=100)
    memo: str = Field(default="", max_length=4000)


class StudyLesson(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    topic: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=200)
    created_at: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)


class QuizHistory(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str = Field(default="", max_length=100)
    lesson: str = Field(default="", max_length=200)
    score: int = Field(ge=0, le=10000)
    total: int = Field(ge=0, le=10000)


class StudyDataPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data: list[StudyItem] = Field(max_length=10000)
    state: dict[SafeId, ReviewProgress] = Field(max_length=10000)
    notes: list[StudyNote] = Field(max_length=5000)
    history: list[QuizHistory] = Field(max_length=5000)
    lessons: list[StudyLesson] = Field(default_factory=list, max_length=1000)

    @model_validator(mode="after")
    def validate_unique_ids(self) -> StudyDataPayload:
        ids = [item.id for item in self.data]
        if len(ids) != len(set(ids)):
            raise ValueError("Study item IDs must be unique.")
        note_ids = [note.id for note in self.notes]
        if len(note_ids) != len(set(note_ids)):
            raise ValueError("Study note IDs must be unique.")
        lesson_ids = [lesson.id for lesson in self.lessons]
        if len(lesson_ids) != len(set(lesson_ids)):
            raise ValueError("Study lesson IDs must be unique.")
        return self

    def as_json(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class SaveStudyDataResponse(BaseModel):
    saved: bool
