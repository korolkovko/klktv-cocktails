from datetime import datetime
from sqlalchemy import (
    Boolean, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship, mapped_column, Mapped
from app.database import Base


# ────────────────────────────────────────────────────────────
# Users
# ────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="reader")
    name: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ────────────────────────────────────────────────────────────
# Lookup tables (id + key/label)
# ────────────────────────────────────────────────────────────

class Spirit(Base):
    __tablename__ = "spirits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Glass(Base):
    __tablename__ = "glasses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Tag(Base):
    """Author cocktail tags: gin, sour, sweet, bitter, blended, hot, premium, etc."""
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)


class Flavor(Base):
    """Author cocktail flavor descriptors (Russian)."""
    __tablename__ = "flavors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)


class Descriptor(Base):
    """Classic cocktail descriptors (Russian): Кислый, Пряный, etc."""
    __tablename__ = "descriptors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)


# ────────────────────────────────────────────────────────────
# Classic families (Sour, Daisy, Negroni, etc.)
# ────────────────────────────────────────────────────────────

class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sub: Mapped[str | None] = mapped_column(String(128))
    color: Mapped[str | None] = mapped_column(String(16))
    logic: Mapped[str | None] = mapped_column(Text)
    evolution: Mapped[str | None] = mapped_column(Text)
    tip: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    classics: Mapped[list["Classic"]] = relationship(back_populates="family")


# ────────────────────────────────────────────────────────────
# Cocktails (author menu)
# ────────────────────────────────────────────────────────────

class Cocktail(Base):
    __tablename__ = "cocktails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    abv: Mapped[str | None] = mapped_column(String(16))
    tagline: Mapped[str | None] = mapped_column(Text)
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    glass_label_override: Mapped[str | None] = mapped_column(String(64))
    badge_id: Mapped[int | None] = mapped_column(ForeignKey("badges.id", ondelete="SET NULL"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    glass: Mapped["Glass | None"] = relationship()
    badge: Mapped["Badge | None"] = relationship()
    tags: Mapped[list["CocktailTag"]] = relationship(back_populates="cocktail", cascade="all, delete-orphan", order_by="CocktailTag.sort_order")
    flavors: Mapped[list["CocktailFlavor"]] = relationship(back_populates="cocktail", cascade="all, delete-orphan", order_by="CocktailFlavor.sort_order")
    details: Mapped[list["CocktailDetail"]] = relationship(back_populates="cocktail", cascade="all, delete-orphan", order_by="CocktailDetail.sort_order")


class CocktailTag(Base):
    __tablename__ = "cocktail_tags"
    cocktail_id: Mapped[int] = mapped_column(ForeignKey("cocktails.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    cocktail: Mapped["Cocktail"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()


class CocktailFlavor(Base):
    __tablename__ = "cocktail_flavors"
    cocktail_id: Mapped[int] = mapped_column(ForeignKey("cocktails.id", ondelete="CASCADE"), primary_key=True)
    flavor_id: Mapped[int] = mapped_column(ForeignKey("flavors.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    cocktail: Mapped["Cocktail"] = relationship(back_populates="flavors")
    flavor: Mapped["Flavor"] = relationship()


class CocktailDetail(Base):
    """Cocktail story sections: label + text, ordered."""
    __tablename__ = "cocktail_details"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cocktail_id: Mapped[int] = mapped_column(ForeignKey("cocktails.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    cocktail: Mapped["Cocktail"] = relationship(back_populates="details")


# ────────────────────────────────────────────────────────────
# Classics (educational)
# ────────────────────────────────────────────────────────────

class Classic(Base):
    __tablename__ = "classics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="RESTRICT"), index=True)
    year: Mapped[int | None] = mapped_column(Integer)
    origin: Mapped[str | None] = mapped_column(String(128))
    composition: Mapped[str | None] = mapped_column(Text)
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    glass_label_override: Mapped[str | None] = mapped_column(String(64))
    garnish: Mapped[str | None] = mapped_column(Text)
    history: Mapped[str | None] = mapped_column(Text)
    for_whom: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    family: Mapped["Family"] = relationship(back_populates="classics")
    glass: Mapped["Glass | None"] = relationship()
    spirits: Mapped[list["ClassicSpirit"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicSpirit.sort_order")
    descriptors: Mapped[list["ClassicDescriptor"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicDescriptor.sort_order")
    related_cocktails: Mapped[list["ClassicRelatedCocktail"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicRelatedCocktail.sort_order")


class ClassicSpirit(Base):
    __tablename__ = "classic_spirits"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    spirit_id: Mapped[int] = mapped_column(ForeignKey("spirits.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    classic: Mapped["Classic"] = relationship(back_populates="spirits")
    spirit: Mapped["Spirit"] = relationship()


class ClassicDescriptor(Base):
    __tablename__ = "classic_descriptors"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    descriptor_id: Mapped[int] = mapped_column(ForeignKey("descriptors.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    classic: Mapped["Classic"] = relationship(back_populates="descriptors")
    descriptor: Mapped["Descriptor"] = relationship()


class ClassicRelatedCocktail(Base):
    __tablename__ = "classic_related_cocktails"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    cocktail_id: Mapped[int] = mapped_column(ForeignKey("cocktails.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    classic: Mapped["Classic"] = relationship(back_populates="related_cocktails")
    cocktail: Mapped["Cocktail"] = relationship()


# ────────────────────────────────────────────────────────────
# Per-user learned classics progress (Stage B prep, table exists now)
# ────────────────────────────────────────────────────────────

class ClassicProgress(Base):
    """Legacy table — superseded by LearningProgress (D-4.5).
    Kept declared so SQLAlchemy doesn't try to drop it. New code uses
    LearningProgress; existing rows are migrated at startup."""
    __tablename__ = "classic_progress"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    learned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LearningProgress(Base):
    """Generic per-user "learned" mark across all content kinds.
    Slug-based (no FK to specific entity tables) — supports cocktails,
    classics, kitchen, zero, zc, spirits, etc. without table-per-kind
    duplication. `kind` is one of the category kinds used by the frontend."""
    __tablename__ = "learning_progress"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), primary_key=True)
    learned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ────────────────────────────────────────────────────────────
# Cocktail history timeline (educational static content)
# ────────────────────────────────────────────────────────────

class TimelineEntry(Base):
    __tablename__ = "timeline_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    examples: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# ────────────────────────────────────────────────────────────
# Encyclopedia of spirits — own category grouping + specific bottles
# ────────────────────────────────────────────────────────────

class SpiritCategory(Base):
    __tablename__ = "spirit_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    entries: Mapped[list["SpiritEntry"]] = relationship(back_populates="category", order_by="SpiritEntry.sort_order")


class SpiritEntry(Base):
    __tablename__ = "spirit_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("spirit_categories.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    abv: Mapped[str | None] = mapped_column(String(32))
    price: Mapped[str | None] = mapped_column(String(64))
    flavour: Mapped[str | None] = mapped_column(Text)
    brand_country: Mapped[str | None] = mapped_column(Text)
    features: Mapped[str | None] = mapped_column(Text)
    cocktail_pairings: Mapped[str | None] = mapped_column(Text)
    fact: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category: Mapped["SpiritCategory"] = relationship(back_populates="entries")


# ────────────────────────────────────────────────────────────
# Kitchen — food menu, grouped by KitchenCategory
# ────────────────────────────────────────────────────────────

class KitchenCategory(Base):
    __tablename__ = "kitchen_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    dishes: Mapped[list["KitchenDish"]] = relationship(back_populates="category", order_by="KitchenDish.sort_order")


class KitchenDish(Base):
    __tablename__ = "kitchen_dishes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("kitchen_categories.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text)
    timing: Mapped[str | None] = mapped_column(String(32))       # "10", "10-12", "12"
    weight: Mapped[str | None] = mapped_column(String(64))       # "280", "320/50"
    nutrition: Mapped[str | None] = mapped_column(Text)
    serving: Mapped[str | None] = mapped_column(Text)
    interesting_facts: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category: Mapped["KitchenCategory"] = relationship(back_populates="dishes")


# ────────────────────────────────────────────────────────────
# Zero — non-alcoholic cocktails (their own category page)
# ────────────────────────────────────────────────────────────

class ZeroCocktail(Base):
    __tablename__ = "zero_cocktails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    price: Mapped[str | None] = mapped_column(String(32))          # "430 ₽"
    abv: Mapped[str | None] = mapped_column(String(32))            # "Non Alc"
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    glass_label_override: Mapped[str | None] = mapped_column(String(64))
    tagline: Mapped[str | None] = mapped_column(Text)
    ingredients_text: Mapped[str | None] = mapped_column(Text)     # newline-separated list
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    glass: Mapped["Glass | None"] = relationship()
    details: Mapped[list["ZeroCocktailDetail"]] = relationship(back_populates="parent", cascade="all, delete-orphan", order_by="ZeroCocktailDetail.sort_order")


class ZeroCocktailDetail(Base):
    __tablename__ = "zero_cocktail_details"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("zero_cocktails.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    parent: Mapped["ZeroCocktail"] = relationship(back_populates="details")


# ────────────────────────────────────────────────────────────
# Zero Culture — separate brand line (alc + non-alc mixed)
# ────────────────────────────────────────────────────────────

class ZCDrink(Base):
    __tablename__ = "zc_drinks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    is_alcoholic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    price: Mapped[str | None] = mapped_column(String(32))
    abv: Mapped[str | None] = mapped_column(String(32))
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    glass_label_override: Mapped[str | None] = mapped_column(String(64))
    tagline: Mapped[str | None] = mapped_column(Text)
    caffeine_level: Mapped[int | None] = mapped_column(Integer)    # 1..3, only for non-alc
    is_carbonated: Mapped[bool | None] = mapped_column(Boolean)    # nullable; meaningful only for non-alc
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    glass: Mapped["Glass | None"] = relationship()
    details: Mapped[list["ZCDrinkDetail"]] = relationship(back_populates="parent", cascade="all, delete-orphan", order_by="ZCDrinkDetail.sort_order")


class ZCDrinkDetail(Base):
    __tablename__ = "zc_drink_details"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("zc_drinks.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    parent: Mapped["ZCDrink"] = relationship(back_populates="details")


# ────────────────────────────────────────────────────────────
# Navigation categories (the burger menu)
# ────────────────────────────────────────────────────────────

class Category(Base):
    """Public categories shown in the burger menu.

    `key` is the page identifier the frontend routes on (matches the
    `page` state — e.g. "menu", "classics"). `kind` declares which
    backend content type this category surfaces (used in D-3+ when
    burger items dispatch to per-type list pages).

    Admins can rename (`label`), reorder (`sort_order`) and hide
    (`is_visible`) categories. The `key` itself is structural and not
    editable from the UI.
    """
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # one of: menu, classics, spirits, kitchen, zero, zc
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
