from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, Integer, Numeric, String, Text, DateTime, ForeignKey, func,
)
from sqlalchemy.orm import relationship, mapped_column, Mapped
from app.database import Base


# ── Users ──
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="reader")
    name: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # «последний визит»: обновляется на каждом запросе с валидной сессией
    # (get_current_user, троттл 5 мин), а не только при логине. NULL, пока
    # пользователь ни разу не заходил после появления колонки — исторических
    # визитов в проде не было, трекинг стартует с этого момента
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── Lookups ──
class Glass(Base):
    __tablename__ = "glasses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class IceType(Base):
    __tablename__ = "ice_types"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Spirit(Base):
    __tablename__ = "spirits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(64))  # added for consistency
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Flavor(Base):
    __tablename__ = "flavors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)


class Descriptor(Base):
    __tablename__ = "descriptors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


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


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # menu|classics|spirits|kitchen
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ── Drinks (author menu; absorbs cocktails + zero + zc) ──
class DrinkCategory(Base):
    __tablename__ = "drink_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drinks: Mapped[list["Drink"]] = relationship(back_populates="category", order_by="Drink.sort_order, Drink.name")


class Drink(Base):
    __tablename__ = "drinks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("drink_categories.id", ondelete="RESTRICT"), index=True)
    img: Mapped[str | None] = mapped_column(String(256))
    subtitle: Mapped[str | None] = mapped_column(Text)
    is_alcoholic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_zero_culture: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    abv: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    abv_raw: Mapped[str | None] = mapped_column(String(32))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(8), default="₽", nullable=False)
    price_raw: Mapped[str | None] = mapped_column(String(64))
    volume_ml: Mapped[int | None] = mapped_column(Integer)
    caffeine_level: Mapped[int | None] = mapped_column(Integer)
    is_carbonated: Mapped[bool | None] = mapped_column(Boolean)
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    badge_id: Mapped[int | None] = mapped_column(ForeignKey("badges.id", ondelete="SET NULL"))
    ice_id: Mapped[int | None] = mapped_column(ForeignKey("ice_types.id", ondelete="SET NULL"))
    is_hot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recipe: Mapped[str | None] = mapped_column(Text)
    garnish: Mapped[str | None] = mapped_column(Text)
    pitch: Mapped[str | None] = mapped_column(Text)
    about: Mapped[str | None] = mapped_column(Text)
    naming: Mapped[str | None] = mapped_column(Text)
    faq: Mapped[str | None] = mapped_column(Text)
    photo: Mapped[str | None] = mapped_column(String(256))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category: Mapped["DrinkCategory"] = relationship(back_populates="drinks")
    glass: Mapped["Glass | None"] = relationship()
    badge: Mapped["Badge | None"] = relationship()
    ice: Mapped["IceType | None"] = relationship()
    tags: Mapped[list["DrinkTag"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkTag.sort_order")
    flavors: Mapped[list["DrinkFlavor"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkFlavor.sort_order")
    spirits: Mapped[list["DrinkSpirit"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkSpirit.sort_order")
    details: Mapped[list["DrinkDetail"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkDetail.sort_order")


class DrinkTag(Base):
    __tablename__ = "drink_tags"
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()


class DrinkFlavor(Base):
    __tablename__ = "drink_flavors"
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    flavor_id: Mapped[int] = mapped_column(ForeignKey("flavors.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="flavors")
    flavor: Mapped["Flavor"] = relationship()


class DrinkSpirit(Base):
    __tablename__ = "drink_spirits"
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    spirit_id: Mapped[int] = mapped_column(ForeignKey("spirits.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="spirits")
    spirit: Mapped["Spirit"] = relationship()


class DrinkDetail(Base):
    __tablename__ = "drink_details"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="details")


# ── Classics ──
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
    garnish: Mapped[str | None] = mapped_column(Text)
    history: Mapped[str | None] = mapped_column(Text)
    for_whom: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    family: Mapped["Family"] = relationship(back_populates="classics")
    glass: Mapped["Glass | None"] = relationship()
    spirits: Mapped[list["ClassicSpirit"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicSpirit.sort_order")
    descriptors: Mapped[list["ClassicDescriptor"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicDescriptor.sort_order")
    related_drinks: Mapped[list["ClassicRelatedDrink"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicRelatedDrink.sort_order")


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


class ClassicRelatedDrink(Base):
    __tablename__ = "classic_related_drinks"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    classic: Mapped["Classic"] = relationship(back_populates="related_drinks")
    drink: Mapped["Drink"] = relationship()


# ── Spirits catalog ──
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
    abv: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    abv_raw: Mapped[str | None] = mapped_column(String(32))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(8), default="₽", nullable=False)
    serving_ml: Mapped[int | None] = mapped_column(Integer)
    price_raw: Mapped[str | None] = mapped_column(String(64))
    flavour: Mapped[str | None] = mapped_column(Text)
    brand: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    features: Mapped[str | None] = mapped_column(Text)
    cocktail_pairings: Mapped[str | None] = mapped_column(Text)
    fact: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category: Mapped["SpiritCategory"] = relationship(back_populates="entries")


# ── Kitchen ──
class KitchenCategory(Base):
    __tablename__ = "kitchen_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # id tiebreak: every prod dish shares sort_order=0, so without it the
    # within-category order is nondeterministic; id order matches old prod.
    dishes: Mapped[list["KitchenDish"]] = relationship(back_populates="category", order_by="KitchenDish.sort_order, KitchenDish.id")


class KitchenDish(Base):
    __tablename__ = "kitchen_dishes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("kitchen_categories.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(8), default="₽", nullable=False)
    price_raw: Mapped[str | None] = mapped_column(String(32))
    tagline: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    timing_min_low: Mapped[int | None] = mapped_column(Integer)
    timing_min_high: Mapped[int | None] = mapped_column(Integer)
    timing_raw: Mapped[str | None] = mapped_column(String(32))
    weight_g: Mapped[int | None] = mapped_column(Integer)
    weight_raw: Mapped[str | None] = mapped_column(String(64))
    kcal_portion: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    protein_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    fat_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    carb_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    kcal_100g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    nutrition_raw: Mapped[str | None] = mapped_column(Text)
    serving: Mapped[str | None] = mapped_column(Text)
    interesting_facts: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category: Mapped["KitchenCategory"] = relationship(back_populates="dishes")


# ── Progress (slug-keyed; rename-migration handled in CRUD layer, Phase 1) ──
class LearningProgress(Base):
    __tablename__ = "learning_progress"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), primary_key=True)
    learned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Timeline (retained; not surfaced yet) ──
class TimelineEntry(Base):
    __tablename__ = "timeline_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    examples: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
