-- ЮНОСТЬ · Supabase PostgreSQL. Выполнить целиком в SQL Editor своего проекта.
-- Предварительные таблицы из первого учебного скрипта сохраняются в отдельной схеме.
BEGIN;


CREATE SCHEMA IF NOT EXISTS yunost;
REVOKE ALL ON SCHEMA yunost FROM public, anon, authenticated;
CREATE TABLE IF NOT EXISTS yunost.roles (name text PRIMARY KEY CHECK(name IN('owner','coowner','admin','member')));
INSERT INTO yunost.roles VALUES('owner'),('coowner'),('admin'),('member') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS yunost.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK(length(full_name) BETWEEN 5 AND 140),
 email text NOT NULL, birth_date date CHECK(birth_date >= DATE '1990-01-01'), phone text NOT NULL DEFAULT '',
 about text NOT NULL DEFAULT '', experience text NOT NULL DEFAULT '',
 role text NOT NULL DEFAULT 'member' REFERENCES yunost.roles(name),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','ignored','deleting')),
 apples bigint NOT NULL DEFAULT 0 CHECK(apples>=0), earned_apples bigint NOT NULL DEFAULT 0 CHECK(earned_apples>=0),
 attended_events integer NOT NULL DEFAULT 0 CHECK(attended_events>=0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email ON yunost.profiles(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_owner ON yunost.profiles(role) WHERE role='owner';
CREATE TABLE IF NOT EXISTS yunost.applications (
 user_id uuid PRIMARY KEY REFERENCES yunost.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','ignored')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 reviewed_by uuid REFERENCES yunost.profiles(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS yunost.media (
 id uuid PRIMARY KEY, owner_id uuid REFERENCES yunost.profiles(id) ON DELETE SET NULL,
 content_type text NOT NULL, bytes bigint NOT NULL CHECK(bytes BETWEEN 1 AND 5242880), ready boolean NOT NULL DEFAULT false,
 deleting boolean NOT NULL DEFAULT false, delete_after timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE TABLE IF NOT EXISTS yunost.publications (
 id uuid PRIMARY KEY, author_id uuid REFERENCES yunost.profiles(id) ON DELETE SET NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 180), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 12000),
 type text NOT NULL CHECK(type IN('news','event')), audience text NOT NULL CHECK(audience IN('public','team')),
 state text NOT NULL CHECK(state IN('draft','published','deleting')), publish_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL,
 CHECK(expires_at>publish_at)
);
CREATE TABLE IF NOT EXISTS yunost.publication_images (
 publication_id uuid REFERENCES yunost.publications(id) ON DELETE CASCADE,
 media_id uuid REFERENCES yunost.media(id), position integer NOT NULL CHECK(position BETWEEN 0 AND 5),
 PRIMARY KEY(publication_id,media_id), UNIQUE(publication_id,position)
);
CREATE TABLE IF NOT EXISTS yunost.events (
 id uuid PRIMARY KEY, author_id uuid REFERENCES yunost.profiles(id) ON DELETE SET NULL,
 title text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, place text NOT NULL,
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 1000), cost bigint NOT NULL CHECK(cost BETWEEN 0 AND 100000),
 reward bigint NOT NULL CHECK(reward BETWEEN 0 AND 100000), ever_booked boolean NOT NULL DEFAULT false,
 cancelled boolean NOT NULL DEFAULT false, poster_deleted boolean NOT NULL DEFAULT false, CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS yunost.event_registrations (
 event_id uuid REFERENCES yunost.events(id) ON DELETE CASCADE, user_id uuid REFERENCES yunost.profiles(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN('registered','present','absent','cancelled')),
 paid bigint NOT NULL, reward bigint NOT NULL, revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS yunost.event_history (
 user_id uuid REFERENCES yunost.profiles(id) ON DELETE CASCADE, event_id uuid, title text NOT NULL,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, place text NOT NULL, status text NOT NULL,
 paid bigint NOT NULL, reward bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,event_id)
);
CREATE TABLE IF NOT EXISTS yunost.products (
 id text PRIMARY KEY CHECK(id ~ '^[a-z0-9-]{1,50}$'), author_id uuid REFERENCES yunost.profiles(id) ON DELETE SET NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 120), tag text NOT NULL DEFAULT '',
 price bigint NOT NULL CHECK(price BETWEEN 0 AND 100000), category text NOT NULL, slot text NOT NULL CHECK(slot IN('head','eyes','neck','body')),
 image_id uuid REFERENCES yunost.media(id), outfit_id uuid REFERENCES yunost.media(id), asset_key text NOT NULL DEFAULT '',
 model_key text NOT NULL CHECK(model_key IN('panama','glasses','tie','scarf','beanie','hoodie')), color text NOT NULL DEFAULT '#75b4dd' CHECK(color ~ '^#[0-9A-Fa-f]{6}$'), version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS yunost.purchases (
 user_id uuid REFERENCES yunost.profiles(id) ON DELETE CASCADE, item_key text,
 product_id text REFERENCES yunost.products(id) ON DELETE SET NULL,
 title text NOT NULL, tag text NOT NULL, price bigint NOT NULL, category text NOT NULL, slot text NOT NULL,
 image_id uuid REFERENCES yunost.media(id), outfit_id uuid REFERENCES yunost.media(id), asset_key text NOT NULL,
 model_key text NOT NULL, color text NOT NULL, purchased_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_key)
);
CREATE TABLE IF NOT EXISTS yunost.equipped_items (
 user_id uuid NOT NULL, item_key text NOT NULL, slot text NOT NULL,
 PRIMARY KEY(user_id,slot), FOREIGN KEY(user_id,item_key) REFERENCES yunost.purchases(user_id,item_key) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS yunost.apple_transactions (
 user_id uuid REFERENCES yunost.profiles(id) ON DELETE CASCADE, operation_id text,
 amount bigint NOT NULL, kind text NOT NULL CHECK(kind IN('purchase','event_payment','event_refund','event_reward')),
 title text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE IF NOT EXISTS yunost.settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS yunost.deletion_jobs (user_id uuid PRIMARY KEY, requested_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS publications_feed ON yunost.publications(state,publish_at DESC);
CREATE INDEX IF NOT EXISTS publications_expiry ON yunost.publications(expires_at);
CREATE INDEX IF NOT EXISTS registrations_user ON yunost.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS media_cleanup ON yunost.media(delete_after);
CREATE INDEX IF NOT EXISTS images_media ON yunost.publication_images(media_id);
CREATE INDEX IF NOT EXISTS transactions_time ON yunost.apple_transactions(user_id,at DESC);
CREATE INDEX IF NOT EXISTS history_time ON yunost.event_history(user_id,updated_at DESC);

CREATE OR REPLACE FUNCTION yunost.fail(code text, message text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION USING ERRCODE=code,MESSAGE=message; END $$;
CREATE OR REPLACE FUNCTION yunost.member(uid uuid, admin boolean DEFAULT false, accepted boolean DEFAULT false) RETURNS yunost.profiles LANGUAGE plpgsql SET search_path='' AS $$
DECLARE u yunost.profiles;
BEGIN SELECT * INTO u FROM yunost.profiles WHERE id=uid;
 IF NOT FOUND OR u.status='deleting' THEN PERFORM yunost.fail('PT401','Войдите в личный кабинет.'); END IF;
 IF accepted AND u.status<>'accepted' THEN PERFORM yunost.fail('PT403','Доступ откроется после принятия в отряд.'); END IF;
 IF admin AND (u.status<>'accepted' OR u.role NOT IN('owner','coowner','admin')) THEN PERFORM yunost.fail('PT403','Этот раздел доступен только администраторам.'); END IF;
 RETURN u;
END $$;
CREATE OR REPLACE FUNCTION yunost.can_edit(uid uuid, author uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE u yunost.profiles; BEGIN u:=yunost.member(uid,true); IF u.role='admin' AND uid IS DISTINCT FROM author THEN PERFORM yunost.fail('PT403','Администратор может изменять только свои записи.'); END IF; END $$;
CREATE OR REPLACE FUNCTION yunost.media_url(id uuid, fallback text DEFAULT '') RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE WHEN id IS NULL THEN fallback ELSE '/api/media/'||id END $$;
CREATE OR REPLACE FUNCTION yunost.purchase_view(p yunost.purchases) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.item_key,'title',p.title,'tag',p.tag,'price',p.price,'category',p.category,'slot',p.slot,'modelKey',p.model_key,'color',p.color,
 'imageUrl',yunost.media_url(p.image_id,'assets/images/product-'||p.asset_key||'.webp'),'outfitUrl',yunost.media_url(p.outfit_id,CASE WHEN p.asset_key='' THEN 'assets/images/mascot.webp' ELSE 'assets/images/look-'||p.asset_key||'.webp' END),'exclusive',p.product_id IS NULL)
$$;
CREATE OR REPLACE FUNCTION yunost.profile_view(uid uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'fullName',p.full_name,'email',p.email,'birthDate',p.birth_date,'phone',p.phone,'about',p.about,'experience',p.experience,
 'role',p.role,'membershipStatus',p.status,'canManage',p.status='accepted' AND p.role IN('owner','coowner','admin'),
 'apples',p.apples,'earnedApples',p.earned_apples,'attendedEvents',p.attended_events,
 'ownedItems',coalesce((SELECT jsonb_agg(x.item_key) FROM yunost.purchases x WHERE x.user_id=uid),'[]'),
 'inventory',coalesce((SELECT jsonb_agg(yunost.purchase_view(x)) FROM yunost.purchases x WHERE x.user_id=uid),'[]'),
 'equippedItems',coalesce((SELECT jsonb_agg(x.item_key) FROM yunost.equipped_items x WHERE x.user_id=uid),'[]')) FROM yunost.profiles p WHERE id=uid
$$;
CREATE OR REPLACE FUNCTION yunost.event_view(e yunost.events) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',e.id,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'place',e.place,'capacity',e.capacity,'cost',e.cost,'reward',e.reward,'authorId',e.author_id,'everBooked',e.ever_booked,'cancelled',e.cancelled,'posterDeleted',e.poster_deleted,
 'registered',(SELECT count(*) FROM yunost.event_registrations WHERE event_id=e.id AND status<>'cancelled'),
 'pending',(SELECT count(*) FROM yunost.event_registrations WHERE event_id=e.id AND status='registered'))
$$;
CREATE OR REPLACE FUNCTION yunost.post_view(p yunost.publications) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'type',p.type,'audience',p.audience,'state',p.state,'authorId',p.author_id,'publishAt',p.publish_at,'expiresAt',p.expires_at,'version',p.version,
 'mediaIds',coalesce((SELECT jsonb_agg(i.media_id ORDER BY i.position) FROM yunost.publication_images i WHERE i.publication_id=p.id),'[]'),
 'photos',coalesce((SELECT jsonb_agg(yunost.media_url(i.media_id) ORDER BY i.position) FROM yunost.publication_images i WHERE i.publication_id=p.id),'[]'),
 'eventInfo',(SELECT yunost.event_view(e) FROM yunost.events e WHERE e.id=p.id))
$$;
CREATE OR REPLACE FUNCTION yunost.product_view(p yunost.products) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'title',p.title,'tag',p.tag,'price',p.price,'category',p.category,'slot',p.slot,'version',p.version,'authorId',p.author_id,'modelKey',p.model_key,'color',p.color,'imageId',p.image_id,'outfitId',p.outfit_id,
 'imageUrl',yunost.media_url(p.image_id,'assets/images/product-'||p.asset_key||'.webp'),'outfitUrl',yunost.media_url(p.outfit_id,CASE WHEN p.asset_key='' THEN 'assets/images/mascot.webp' ELSE 'assets/images/look-'||p.asset_key||'.webp' END))
$$;
CREATE OR REPLACE FUNCTION yunost.check_media(uid uuid, mid uuid, reuse boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m yunost.media; u yunost.profiles; BEGIN
 IF mid IS NULL THEN RETURN; END IF; u:=yunost.member(uid,true); SELECT * INTO m FROM yunost.media WHERE id=mid;
 IF NOT FOUND OR NOT m.ready OR m.deleting THEN PERFORM yunost.fail('PT409','Фотография недоступна. Загрузите её заново.'); END IF;
 IF NOT coalesce(reuse,false) AND u.role='admin' AND m.owner_id IS DISTINCT FROM uid THEN PERFORM yunost.fail('PT403','Выберите свою загруженную фотографию.'); END IF;
END $$;
CREATE OR REPLACE FUNCTION yunost.receipt(e yunost.events, r yunost.event_registrations) RETURNS void LANGUAGE sql SET search_path='' AS $$
 INSERT INTO yunost.event_history(user_id,event_id,title,starts_at,ends_at,place,status,paid,reward) VALUES(r.user_id,e.id,e.title,e.starts_at,e.ends_at,e.place,r.status,r.paid,r.reward)
 ON CONFLICT(user_id,event_id) DO UPDATE SET status=excluded.status,title=excluded.title,paid=excluded.paid,reward=excluded.reward,updated_at=now()
$$;
CREATE OR REPLACE FUNCTION yunost.finish_registration(eid uuid, uid uuid, decision text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE e yunost.events; r yunost.event_registrations; amount bigint;
BEGIN
 SELECT * INTO e FROM yunost.events WHERE id=eid; SELECT * INTO r FROM yunost.event_registrations WHERE event_id=eid AND user_id=uid;
 IF NOT FOUND THEN PERFORM yunost.fail('PT404','Запись на мероприятие не найдена.'); END IF;
 IF r.status=decision THEN RETURN; END IF;
 IF r.status<>'registered' THEN PERFORM yunost.fail('PT409','По участнику уже принято решение. Повторной награды не будет.'); END IF;
 amount:=CASE decision WHEN 'cancelled' THEN r.paid WHEN 'present' THEN r.reward ELSE 0 END;
 UPDATE yunost.event_registrations SET status=decision WHERE event_id=eid AND user_id=uid RETURNING * INTO r;
 IF EXISTS(SELECT 1 FROM yunost.profiles WHERE id=uid AND status<>'deleting') THEN
   UPDATE yunost.profiles SET apples=apples+amount,earned_apples=earned_apples+CASE WHEN decision='present' THEN r.reward ELSE 0 END,attended_events=attended_events+CASE WHEN decision='present' THEN 1 ELSE 0 END WHERE id=uid;
   PERFORM yunost.receipt(e,r);
   IF decision<>'absent' THEN INSERT INTO yunost.apple_transactions VALUES(uid,'event_'||eid||'_'||r.revision||'_'||decision,amount,CASE WHEN decision='present' THEN 'event_reward' ELSE 'event_refund' END,e.title,now()); END IF;
 END IF;
END $$;

-- Auth и анкета создаются в одной транзакции. Метаданные никогда не назначают роль.
CREATE OR REPLACE FUNCTION yunost.on_auth_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $signup$
DECLARE d jsonb:=NEW.raw_user_meta_data->'yunost_profile';
BEGIN
 IF d IS NOT NULL THEN
  IF (d->>'birthDate')::date>(now() AT TIME ZONE 'Asia/Novosibirsk')::date OR length(d->>'phone') NOT BETWEEN 10 AND 30 OR length(d->>'about') NOT BETWEEN 1 AND 2000 OR length(coalesce(d->>'experience',''))>2000 THEN RAISE EXCEPTION 'Некорректная анкета'; END IF;
  INSERT INTO yunost.profiles(id,full_name,email,birth_date,phone,about,experience) VALUES(NEW.id,d->>'fullName',lower(NEW.email),(d->>'birthDate')::date,d->>'phone',d->>'about',coalesce(d->>'experience',''));
  INSERT INTO yunost.applications(user_id) VALUES(NEW.id);
 END IF;
 RETURN NEW;
END $signup$;
DROP TRIGGER IF EXISTS yunost_signup ON auth.users;
CREATE TRIGGER yunost_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION yunost.on_auth_signup();

-- Единственная точка входа данных: доступна ТОЛЬКО серверному secret key.
-- Клиентский publishable key не может передать чужой p_actor или изменить баланс.
CREATE OR REPLACE FUNCTION public.yunost_api(p_action text, p_actor uuid DEFAULT NULL, p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $api$
#variable_conflict use_column
DECLARE
 d jsonb:=coalesce(p_data,'{}'); u yunost.profiles; target yunost.profiles; p yunost.publications; e yunost.events;
 r yunost.event_registrations; prod yunost.products; bought yunost.purchases; m yunost.media;
 uid uuid; key uuid; item text; mid uuid; image_ids uuid[]; previous_ids uuid[]; decision text; result jsonb; rowdata record;
 offset_value integer:=greatest(0,least(100000,coalesce(nullif(p_data->>'cursor','')::integer,0)));
 starts timestamptz; ends timestamptz; pub_at timestamptz; exp_at timestamptz; retention integer; amount bigint; version_number integer;
BEGIN
 -- Короткая блокировка сериализует изменения внутри одного отряда. Сетевых запросов в транзакции нет.
 IF p_action NOT IN('profile','email_exists','posts','post','products','members','applications','team','events','participants','my_events','registration','transactions','leaderboard','achievements','cleanup_settings','media_read','jobs','ready')
 THEN PERFORM pg_advisory_xact_lock(82736401); END IF;
 IF p_actor IS NOT NULL THEN u:=yunost.member(p_actor); END IF;
 CASE p_action
 WHEN 'ready' THEN RETURN jsonb_build_object('schemaVersion',1);
 WHEN 'email_exists' THEN RETURN jsonb_build_object('exists',EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(d->>'email')));
 WHEN 'profile_create' THEN
   uid:=(d->>'id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND lower(email)=lower(d->>'email')) THEN PERFORM yunost.fail('PT409','Эта почта уже зарегистрирована. Войдите в аккаунт.'); END IF;
   IF EXISTS(SELECT 1 FROM yunost.profiles WHERE id=uid) THEN PERFORM yunost.fail('PT409','Анкета уже существует.'); END IF;
   INSERT INTO yunost.profiles(id,full_name,email,birth_date,phone,about,experience) VALUES(uid,d->>'fullName',lower(d->>'email'),(d->>'birthDate')::date,d->>'phone',d->>'about',coalesce(d->>'experience',''));
   INSERT INTO yunost.applications(user_id) VALUES(uid); RETURN yunost.profile_view(uid);
 WHEN 'owner_setup' THEN
   uid:=(d->>'id')::uuid;
   SELECT value->>'ownerId' INTO item FROM yunost.settings s WHERE s.key='ownership';
   IF item IS NOT NULL AND item<>uid::text THEN PERFORM yunost.fail('PT409','Владелец уже назначен. Эта команда не заменяет владельца.'); END IF;
   IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND lower(email)=lower(d->>'email')) THEN PERFORM yunost.fail('PT400','Сначала создайте этот аккаунт в Supabase Auth.'); END IF;
   INSERT INTO yunost.profiles(id,full_name,email,role,status) VALUES(uid,d->>'fullName',lower(d->>'email'),'owner','accepted') ON CONFLICT(id) DO UPDATE SET role='owner',status='accepted';
   INSERT INTO yunost.settings VALUES('ownership',jsonb_build_object('ownerId',uid)) ON CONFLICT(key) DO NOTHING;
   UPDATE yunost.applications SET status='accepted',reviewed_at=now() WHERE user_id=uid; RETURN yunost.profile_view(uid);
 WHEN 'profile' THEN u:=yunost.member(p_actor); RETURN yunost.profile_view(p_actor);
 WHEN 'profile_update' THEN
   u:=yunost.member(p_actor); UPDATE yunost.profiles SET full_name=d->>'fullName',phone=d->>'phone',about=d->>'about',experience=coalesce(d->>'experience','') WHERE id=p_actor;
   RETURN yunost.profile_view(p_actor);
 WHEN 'applications' THEN
   u:=yunost.member(p_actor,true);
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (
    SELECT jsonb_build_object('id',x.id,'fullName',x.full_name,'birthDate',x.birth_date,'email',x.email,'phone',x.phone,'about',x.about,'experience',x.experience,'status',a.status,'createdAt',a.created_at,'reviewedAt',a.reviewed_at) v
    FROM yunost.applications a JOIN yunost.profiles x ON x.id=a.user_id WHERE a.status=coalesce(d->>'status','pending') AND x.status<>'deleting' ORDER BY a.created_at,x.id LIMIT 30 OFFSET offset_value
   ) q;
 WHEN 'review' THEN
   u:=yunost.member(p_actor,true); uid:=(d->>'id')::uuid; decision:=d->>'decision';
   IF decision NOT IN('accepted','ignored') THEN PERFORM yunost.fail('PT400','Выберите «Принять» или «Игнорировать».'); END IF;
   target:=yunost.member(uid);
   IF target.status=decision THEN RETURN jsonb_build_object('success',true); END IF;
   IF target.status<>'pending' OR target.role<>'member' THEN PERFORM yunost.fail('PT409','По этой заявке уже принято решение.'); END IF;
   UPDATE yunost.profiles SET status=decision WHERE id=uid;
   UPDATE yunost.applications SET status=decision,reviewed_by=p_actor,reviewed_at=now() WHERE user_id=uid; RETURN jsonb_build_object('success',true);
 WHEN 'team' THEN
   u:=yunost.member(p_actor,true); IF u.role NOT IN('owner','coowner') THEN PERFORM yunost.fail('PT403','Назначать администраторов могут владелец и совладелец.'); END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'fullName',full_name,'email',email,'role',role,'membershipStatus',status)),'[]') INTO result FROM yunost.profiles WHERE lower(email)=lower(d->>'email') AND status<>'deleting';
 WHEN 'role' THEN
   u:=yunost.member(p_actor,true); uid:=(d->>'id')::uuid; target:=yunost.member(uid); item:=d->>'role';
   IF uid=p_actor OR target.role='owner' OR item NOT IN('member','admin','coowner') OR (u.role<>'owner' AND NOT(u.role='coowner' AND target.role IN('member','admin') AND item IN('member','admin'))) THEN PERFORM yunost.fail('PT403','У вас нет права изменять эту роль.'); END IF;
   IF target.status<>'accepted' THEN PERFORM yunost.fail('PT409','Сначала примите участника в отряд.'); END IF;
   UPDATE yunost.profiles SET role=item WHERE id=uid; RETURN jsonb_build_object('success',true);
 WHEN 'members' THEN
   u:=yunost.member(p_actor,true); IF u.role NOT IN('owner','coowner') THEN PERFORM yunost.fail('PT403','Список аккаунтов доступен владельцу и совладельцу.'); END IF;
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT jsonb_build_object('id',id,'fullName',full_name,'email',email,'role',role,'membershipStatus',status,'canDelete',id<>p_actor AND role<>'owner' AND (u.role='owner' OR role<>'coowner')) v FROM yunost.profiles ORDER BY created_at,id LIMIT 30 OFFSET offset_value) q;
 WHEN 'delete_request' THEN
   u:=yunost.member(p_actor,true); uid:=(d->>'id')::uuid; SELECT * INTO target FROM yunost.profiles WHERE id=uid;
   IF u.role NOT IN('owner','coowner') THEN PERFORM yunost.fail('PT403','Удалять аккаунты могут владелец и совладелец.'); END IF;
   IF target.id IS NULL THEN RETURN jsonb_build_object('success',true,'queued',false); END IF;
   IF uid=p_actor OR target.role='owner' OR (u.role='coowner' AND target.role='coowner') THEN PERFORM yunost.fail('PT403','Этот аккаунт защищён от удаления.'); END IF;
   UPDATE yunost.profiles SET status='deleting',role='member' WHERE id=uid;
   UPDATE yunost.media SET delete_after=now() WHERE owner_id=uid;
   INSERT INTO yunost.deletion_jobs(user_id) VALUES(uid) ON CONFLICT DO NOTHING; RETURN jsonb_build_object('success',true,'queued',true);
 WHEN 'jobs' THEN RETURN coalesce((SELECT jsonb_agg(user_id) FROM (SELECT user_id FROM yunost.deletion_jobs ORDER BY requested_at LIMIT 30) q),'[]');
 WHEN 'delete_done' THEN
   uid:=(d->>'id')::uuid;
   IF EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN PERFORM yunost.fail('PT409','Удаление Supabase Auth ещё не завершено.'); END IF;
   DELETE FROM yunost.deletion_jobs WHERE user_id=uid; RETURN jsonb_build_object('success',true);
 WHEN 'delete_status' THEN
   u:=yunost.member(p_actor,true); IF u.role NOT IN('owner','coowner') THEN PERFORM yunost.fail('PT403','Нет доступа к удалению аккаунтов.'); END IF;
   RETURN jsonb_build_object('pending',EXISTS(SELECT 1 FROM yunost.deletion_jobs WHERE user_id=(d->>'id')::uuid));
 WHEN 'posts' THEN
   IF coalesce((d->>'manage')::boolean,false) THEN u:=yunost.member(p_actor,true); END IF;
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT yunost.post_view(x) v FROM yunost.publications x WHERE
    CASE WHEN coalesce((d->>'manage')::boolean,false) THEN x.state<>'deleting' AND (u.role<>'admin' OR x.author_id=p_actor)
    ELSE x.state='published' AND x.publish_at<=now() AND x.expires_at>now() AND (x.audience='public' OR u.status='accepted') END
    ORDER BY x.publish_at DESC,x.id LIMIT 30 OFFSET offset_value) q;
 WHEN 'post' THEN
   key:=(d->>'id')::uuid; SELECT * INTO p FROM yunost.publications WHERE id=key;
   IF NOT FOUND OR p.state='deleting' THEN PERFORM yunost.fail('PT404','Публикация не найдена.'); END IF;
   IF coalesce((d->>'manage')::boolean,false) THEN PERFORM yunost.can_edit(p_actor,p.author_id);
   ELSIF p.state<>'published' OR p.publish_at>now() OR p.expires_at<=now() OR (p.audience='team' AND coalesce(u.status,'')<>'accepted') THEN PERFORM yunost.fail('PT404','Публикация недоступна или срок её размещения истёк.'); END IF;
   RETURN yunost.post_view(p);
 WHEN 'post_save' THEN
   u:=yunost.member(p_actor,true); key:=(d->>'id')::uuid; SELECT * INTO p FROM yunost.publications WHERE id=key; SELECT * INTO e FROM yunost.events WHERE id=key;
   IF p.id IS NULL AND (e.id IS NOT NULL OR EXISTS(SELECT 1 FROM yunost.event_history WHERE event_id=key)) THEN PERFORM yunost.fail('PT409','Создайте новую публикацию с новым идентификатором.'); END IF;
   IF p.id IS NOT NULL THEN PERFORM yunost.can_edit(p_actor,p.author_id); END IF;
   IF coalesce(p.version,0)<>coalesce((d->>'version')::integer,0) OR p.state='deleting' THEN PERFORM yunost.fail('PT409','Запись уже изменена. Обновите страницу.'); END IF;
   IF p.id IS NOT NULL AND p.type<>d->>'type' THEN PERFORM yunost.fail('PT409','Тип сохранённой публикации менять нельзя.'); END IF;
   pub_at:=(d->>'publishAt')::timestamptz; exp_at:=(d->>'expiresAt')::timestamptz;
   IF exp_at<=pub_at OR exp_at<=now() THEN PERFORM yunost.fail('PT400','Срок показа должен заканчиваться после публикации и текущего времени.'); END IF;
   SELECT coalesce(array_agg(v::uuid),'{}') INTO image_ids FROM jsonb_array_elements_text(coalesce(d->'mediaIds','[]')) v;
   IF cardinality(image_ids)>6 THEN PERFORM yunost.fail('PT400','Можно прикрепить не более 6 фотографий.'); END IF;
   SELECT coalesce(array_agg(media_id),'{}') INTO previous_ids FROM yunost.publication_images WHERE publication_id=key;
   FOREACH mid IN ARRAY image_ids LOOP PERFORM yunost.check_media(p_actor,mid,mid=ANY(previous_ids)); END LOOP;
   IF d->>'type'='event' THEN
    starts:=(d->>'startsAt')::timestamptz; ends:=(d->>'endsAt')::timestamptz;
    IF starts>=ends OR exp_at<ends OR pub_at>=starts THEN PERFORM yunost.fail('PT400','Проверьте время: публикация до начала, окончание после начала, срок показа не раньше окончания.'); END IF;
    IF coalesce(e.ever_booked,false) AND (e.starts_at<>starts OR e.ends_at<>ends OR e.place<>d->>'place' OR e.cost<>(d->>'cost')::bigint OR e.reward<>(d->>'reward')::bigint OR e.capacity<>(d->>'capacity')::integer OR d->>'state'<>'published' OR d->>'audience'<>p.audience OR pub_at>now()) THEN PERFORM yunost.fail('PT409','Участники уже записались. Условия мероприятия закреплены. Для отмены удалите событие с возвратом яблок.'); END IF;
    IF NOT coalesce(e.ever_booked,false) AND d->>'state'='published' AND starts<=now() THEN PERFORM yunost.fail('PT400','Начало нового мероприятия должно быть в будущем.'); END IF;
    INSERT INTO yunost.events(id,author_id,title,starts_at,ends_at,place,capacity,cost,reward) VALUES(key,p_actor,d->>'title',starts,ends,d->>'place',(d->>'capacity')::integer,(d->>'cost')::bigint,(d->>'reward')::bigint)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,place=excluded.place,capacity=excluded.capacity,cost=excluded.cost,reward=excluded.reward;
   END IF;
   INSERT INTO yunost.publications(id,author_id,title,body,type,audience,state,publish_at,expires_at,version) VALUES(key,p_actor,d->>'title',d->>'body',d->>'type',d->>'audience',d->>'state',pub_at,exp_at,1)
   ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,audience=excluded.audience,state=excluded.state,publish_at=excluded.publish_at,expires_at=excluded.expires_at,updated_at=now(),version=yunost.publications.version+1;
   DELETE FROM yunost.publication_images WHERE publication_id=key;
   INSERT INTO yunost.publication_images SELECT key,v,(ord-1)::integer FROM unnest(image_ids) WITH ORDINALITY t(v,ord);
   UPDATE yunost.media SET delete_after=now() WHERE id=ANY(previous_ids) AND NOT(id=ANY(image_ids));
   SELECT * INTO p FROM yunost.publications WHERE id=key; RETURN yunost.post_view(p);
 WHEN 'post_delete' THEN
   key:=(d->>'id')::uuid; SELECT * INTO p FROM yunost.publications WHERE id=key;
   IF NOT FOUND THEN u:=yunost.member(p_actor,true); RETURN jsonb_build_object('success',true); END IF;
   PERFORM yunost.can_edit(p_actor,p.author_id);
   IF p.type='event' THEN
    UPDATE yunost.events SET cancelled=true,poster_deleted=true WHERE id=key;
    FOR r IN SELECT * FROM yunost.event_registrations WHERE event_id=key AND status='registered' LOOP PERFORM yunost.finish_registration(key,r.user_id,'cancelled'); END LOOP;
   END IF;
   UPDATE yunost.media SET delete_after=now() WHERE id IN(SELECT media_id FROM yunost.publication_images WHERE publication_id=key);
   DELETE FROM yunost.publications WHERE id=key; RETURN jsonb_build_object('success',true);
 WHEN 'events' THEN
   u:=yunost.member(p_actor,true);
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT yunost.event_view(x) v FROM yunost.events x WHERE u.role<>'admin' OR x.author_id=p_actor ORDER BY ends_at DESC,id LIMIT 30 OFFSET offset_value) q;
 WHEN 'participants' THEN
   key:=(d->>'id')::uuid; SELECT * INTO e FROM yunost.events WHERE id=key; IF NOT FOUND THEN PERFORM yunost.fail('PT404','Мероприятие не найдено.'); END IF;
   PERFORM yunost.can_edit(p_actor,e.author_id);
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT jsonb_build_object('userId',x.id,'fullName',x.full_name,'status',g.status,'paid',g.paid,'reward',g.reward) v FROM yunost.event_registrations g JOIN yunost.profiles x ON x.id=g.user_id WHERE g.event_id=key AND x.status<>'deleting' ORDER BY g.created_at,x.id LIMIT 30 OFFSET offset_value) q;
   RETURN jsonb_build_object('items',result,'nextCursor',CASE WHEN jsonb_array_length(result)=30 THEN (offset_value+30)::text ELSE NULL END,'eventInfo',yunost.event_view(e));
 WHEN 'registration' THEN
   u:=yunost.member(p_actor,false,true); RETURN jsonb_build_object('status',coalesce((SELECT status FROM yunost.event_registrations WHERE user_id=p_actor AND event_id=(d->>'id')::uuid),'none'));
 WHEN 'event_register' THEN
   u:=yunost.member(p_actor,false,true); key:=(d->>'id')::uuid; SELECT * INTO p FROM yunost.publications WHERE id=key; SELECT * INTO e FROM yunost.events WHERE id=key;
   IF p.id IS NULL OR e.id IS NULL THEN PERFORM yunost.fail('PT404','Мероприятие недоступно.'); END IF;
   IF p.state<>'published' OR p.publish_at>now() OR p.expires_at<=now() OR e.starts_at<=now() OR e.cancelled THEN PERFORM yunost.fail('PT409','Запись на мероприятие закрыта.'); END IF;
   SELECT * INTO r FROM yunost.event_registrations WHERE event_id=key AND user_id=p_actor;
   IF r.status='registered' THEN RETURN yunost.profile_view(p_actor); END IF;
   IF r.status IS NOT NULL AND r.status<>'cancelled' THEN PERFORM yunost.fail('PT409','Участие уже подтверждено.'); END IF;
   IF (SELECT count(*) FROM yunost.event_registrations WHERE event_id=key AND status<>'cancelled')>=e.capacity THEN PERFORM yunost.fail('PT409','Все места заняты.'); END IF;
   IF u.apples<e.cost THEN PERFORM yunost.fail('PT409','Не хватает яблок. Нужно ещё '||(e.cost-u.apples)||'.'); END IF;
   INSERT INTO yunost.event_registrations(event_id,user_id,status,paid,reward,revision) VALUES(key,p_actor,'registered',e.cost,e.reward,1)
   ON CONFLICT(event_id,user_id) DO UPDATE SET status='registered',paid=excluded.paid,reward=excluded.reward,revision=yunost.event_registrations.revision+1,created_at=now() RETURNING * INTO r;
   UPDATE yunost.events SET ever_booked=true WHERE id=key; UPDATE yunost.profiles SET apples=apples-e.cost WHERE id=p_actor;
   PERFORM yunost.receipt(e,r); INSERT INTO yunost.apple_transactions VALUES(p_actor,'event_'||key||'_'||r.revision||'_payment',-e.cost,'event_payment',e.title,now()); RETURN yunost.profile_view(p_actor);
 WHEN 'event_cancel' THEN
   u:=yunost.member(p_actor,false,true); key:=(d->>'id')::uuid; SELECT * INTO e FROM yunost.events WHERE id=key;
   IF NOT FOUND THEN PERFORM yunost.fail('PT404','Мероприятие не найдено.'); END IF;
   IF EXISTS(SELECT 1 FROM yunost.event_registrations WHERE event_id=key AND user_id=p_actor AND status='cancelled') THEN RETURN yunost.profile_view(p_actor); END IF;
   IF e.starts_at<=now() THEN PERFORM yunost.fail('PT409','После начала события запись отменяет администратор.'); END IF;
   PERFORM yunost.finish_registration(key,p_actor,'cancelled'); RETURN yunost.profile_view(p_actor);
 WHEN 'attendance' THEN
   key:=(d->>'id')::uuid; uid:=(d->>'userId')::uuid; decision:=d->>'decision'; SELECT * INTO e FROM yunost.events WHERE id=key;
   IF NOT FOUND THEN PERFORM yunost.fail('PT404','Мероприятие не найдено.'); END IF;
   PERFORM yunost.can_edit(p_actor,e.author_id);
   IF decision NOT IN('present','absent') THEN PERFORM yunost.fail('PT400','Выберите «Участвовал» или «Не пришёл».'); END IF;
   IF e.cancelled OR e.ends_at>now() THEN PERFORM yunost.fail('PT409','Подтверждать участие можно после окончания мероприятия.'); END IF;
   PERFORM yunost.finish_registration(key,uid,decision); RETURN jsonb_build_object('success',true);
 WHEN 'my_events' THEN
   u:=yunost.member(p_actor,false,true);
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT jsonb_build_object('id',event_id,'title',title,'startsAt',starts_at,'endsAt',ends_at,'place',place,'status',status,'paid',paid,'reward',reward) v FROM yunost.event_history WHERE user_id=p_actor ORDER BY updated_at DESC,event_id LIMIT 30 OFFSET offset_value) q;
 WHEN 'transactions' THEN
   u:=yunost.member(p_actor,false,true);
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT jsonb_build_object('id',operation_id,'amount',amount,'kind',kind,'title',title,'at',at) v FROM yunost.apple_transactions WHERE user_id=p_actor ORDER BY at DESC,operation_id LIMIT 30 OFFSET offset_value) q;
 WHEN 'leaderboard' THEN
   u:=yunost.member(p_actor,false,true);
   SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (SELECT jsonb_build_object('place',row_number() OVER(ORDER BY earned_apples DESC,id),'fullName',full_name,'earnedApples',earned_apples,'attendedEvents',attended_events,'isMe',id=p_actor) v FROM yunost.profiles WHERE status='accepted' ORDER BY earned_apples DESC,id LIMIT 50) q;
 WHEN 'achievements' THEN
   u:=yunost.member(p_actor,false,true);
   RETURN jsonb_build_object('items',jsonb_build_array(
    jsonb_build_object('id','first','title','Первый шаг','description','Участвовать в первом мероприятии','current',u.attended_events,'target',1),
    jsonb_build_object('id','five','title','В ритме отряда','description','Участвовать в пяти мероприятиях','current',u.attended_events,'target',5),
    jsonb_build_object('id','ten','title','Душа команды','description','Участвовать в десяти мероприятиях','current',u.attended_events,'target',10),
    jsonb_build_object('id','apples','title','Урожай идей','description','Заработать 100 яблок за участие','current',u.earned_apples,'target',100)));
 WHEN 'products' THEN
   u:=yunost.member(p_actor); IF coalesce((d->>'manage')::boolean,false) THEN u:=yunost.member(p_actor,true); END IF;
   SELECT coalesce(jsonb_agg(yunost.product_view(x) ORDER BY x.id),'[]') INTO result FROM yunost.products x WHERE NOT coalesce((d->>'manage')::boolean,false) OR u.role<>'admin' OR x.author_id=p_actor;
 WHEN 'product_save' THEN
   u:=yunost.member(p_actor,true); item:=d->>'id'; SELECT * INTO prod FROM yunost.products WHERE id=item;
   IF prod.id IS NOT NULL THEN PERFORM yunost.can_edit(p_actor,prod.author_id); END IF;
   IF coalesce(prod.version,0)<>coalesce((d->>'version')::integer,0) THEN PERFORM yunost.fail('PT409','Вещь уже изменена. Обновите страницу.'); END IF;
   IF prod.id IS NULL AND EXISTS(SELECT 1 FROM yunost.purchases WHERE item_key=item) THEN PERFORM yunost.fail('PT409','Этот идентификатор уже использован купленной вещью. Создайте новый товар.'); END IF;
   IF prod.id IS NULL AND (SELECT count(*) FROM yunost.products)>=200 THEN PERFORM yunost.fail('PT409','В магазине уже 200 вещей. Уберите старые перед добавлением новых.'); END IF;
   key:=nullif(d->>'imageId','')::uuid; uid:=nullif(d->>'outfitId','')::uuid;
   IF key IS NULL AND coalesce(prod.asset_key,'')='' THEN PERFORM yunost.fail('PT400','Загрузите фотографию вещи.'); END IF;
   PERFORM yunost.check_media(p_actor,key,key=prod.image_id); PERFORM yunost.check_media(p_actor,uid,uid=prod.outfit_id);
   IF (d->>'modelKey' IN('panama','beanie') AND d->>'slot'<>'head') OR (d->>'modelKey'='glasses' AND d->>'slot'<>'eyes') OR (d->>'modelKey' IN('tie','scarf') AND d->>'slot'<>'neck') OR (d->>'modelKey'='hoodie' AND d->>'slot'<>'body') THEN PERFORM yunost.fail('PT400','Тип вещи не соответствует её 3D-форме.'); END IF;
   INSERT INTO yunost.products(id,author_id,title,tag,price,category,slot,image_id,outfit_id,asset_key,model_key,color) VALUES(item,p_actor,d->>'title',coalesce(d->>'tag',''),(d->>'price')::bigint,d->>'category',d->>'slot',key,uid,coalesce(prod.asset_key,''),d->>'modelKey',d->>'color')
   ON CONFLICT(id) DO UPDATE SET title=excluded.title,tag=excluded.tag,price=excluded.price,category=excluded.category,slot=excluded.slot,image_id=excluded.image_id,outfit_id=excluded.outfit_id,model_key=excluded.model_key,color=excluded.color,version=yunost.products.version+1;
   UPDATE yunost.media SET delete_after=now() WHERE id IN(prod.image_id,prod.outfit_id) AND id IS DISTINCT FROM key AND id IS DISTINCT FROM uid; RETURN jsonb_build_object('success',true);
 WHEN 'product_delete' THEN
   u:=yunost.member(p_actor,true); SELECT * INTO prod FROM yunost.products WHERE id=d->>'id'; IF prod.id IS NULL THEN RETURN jsonb_build_object('success',true); END IF;
   PERFORM yunost.can_edit(p_actor,prod.author_id); DELETE FROM yunost.products WHERE id=prod.id;
   UPDATE yunost.media SET delete_after=now() WHERE id IN(prod.image_id,prod.outfit_id); RETURN jsonb_build_object('success',true);
 WHEN 'purchase' THEN
   u:=yunost.member(p_actor,false,true); item:=d->>'id';
   IF EXISTS(SELECT 1 FROM yunost.purchases WHERE user_id=p_actor AND item_key=item) THEN RETURN yunost.profile_view(p_actor); END IF;
   SELECT * INTO prod FROM yunost.products WHERE id=item; IF NOT FOUND THEN PERFORM yunost.fail('PT404','Эта вещь больше не продаётся.'); END IF;
   IF u.apples<prod.price THEN PERFORM yunost.fail('PT409','Не хватает яблок. Нужно ещё '||(prod.price-u.apples)||'.'); END IF;
   INSERT INTO yunost.purchases(user_id,item_key,product_id,title,tag,price,category,slot,image_id,outfit_id,asset_key,model_key,color) VALUES(p_actor,item,item,prod.title,prod.tag,prod.price,prod.category,prod.slot,prod.image_id,prod.outfit_id,prod.asset_key,prod.model_key,prod.color);
   UPDATE yunost.profiles SET apples=apples-prod.price WHERE id=p_actor; INSERT INTO yunost.apple_transactions VALUES(p_actor,'purchase_'||item,-prod.price,'purchase',prod.title,now()); RETURN yunost.profile_view(p_actor);
 WHEN 'equip' THEN
   u:=yunost.member(p_actor,false,true); item:=d->>'productId'; SELECT * INTO bought FROM yunost.purchases WHERE user_id=p_actor AND item_key=item;
   IF NOT FOUND THEN PERFORM yunost.fail('PT403','Надеть можно только купленную вещь.'); END IF;
   IF NOT coalesce((d->>'equipped')::boolean,false) THEN DELETE FROM yunost.equipped_items WHERE user_id=p_actor AND item_key=item;
   ELSE
    DELETE FROM yunost.equipped_items WHERE user_id=p_actor AND (slot=bought.slot OR (bought.slot='body' AND slot='neck') OR (bought.slot='neck' AND slot='body'));
    INSERT INTO yunost.equipped_items VALUES(p_actor,item,bought.slot);
   END IF; RETURN yunost.profile_view(p_actor);
 WHEN 'media_reserve' THEN
   u:=yunost.member(p_actor,true); key:=(d->>'id')::uuid;
   INSERT INTO yunost.media(id,owner_id,content_type,bytes) VALUES(key,p_actor,d->>'contentType',(d->>'bytes')::bigint); RETURN jsonb_build_object('id',key);
 WHEN 'media_ready' THEN
   UPDATE yunost.media SET ready=true WHERE id=(d->>'id')::uuid AND NOT deleting; RETURN jsonb_build_object('success',true);
 WHEN 'media_read' THEN
   key:=(d->>'id')::uuid; SELECT * INTO m FROM yunost.media WHERE id=key AND ready AND NOT deleting;
   IF NOT FOUND THEN PERFORM yunost.fail('PT404','Фотография не найдена.'); END IF;
   IF NOT coalesce((
    (u.status='accepted' AND u.role IN('owner','coowner')) OR (u.status='accepted' AND u.role='admin' AND m.owner_id=p_actor)
    OR EXISTS(SELECT 1 FROM yunost.publication_images i JOIN yunost.publications x ON x.id=i.publication_id WHERE i.media_id=key AND
     ((x.state='published' AND x.publish_at<=now() AND x.expires_at>now() AND (x.audience='public' OR u.status='accepted')) OR (u.status='accepted' AND u.role='admin' AND x.author_id=p_actor)))
    OR (p_actor IS NOT NULL AND EXISTS(SELECT 1 FROM yunost.products WHERE image_id=key OR outfit_id=key))
    OR EXISTS(SELECT 1 FROM yunost.purchases WHERE user_id=p_actor AND (image_id=key OR outfit_id=key))
   ),false) THEN PERFORM yunost.fail('PT404','Фотография недоступна.'); END IF;
   RETURN jsonb_build_object('contentType',m.content_type);
 WHEN 'cleanup_settings' THEN
   u:=yunost.member(p_actor,true); RETURN jsonb_build_object('retentionDays',coalesce((SELECT (value->>'days')::integer FROM yunost.settings s WHERE s.key='cleanup'),0),'canEdit',u.role IN('owner','coowner'));
 WHEN 'cleanup_set' THEN
   u:=yunost.member(p_actor,true); retention:=(d->>'retentionDays')::integer;
   IF u.role NOT IN('owner','coowner') THEN PERFORM yunost.fail('PT403','Настройки очистки меняют владелец и совладелец.'); END IF;
   IF retention NOT IN(0,1,7,30) THEN PERFORM yunost.fail('PT400','Выберите 0, 1, 7 или 30 дней.'); END IF;
   INSERT INTO yunost.settings VALUES('cleanup',jsonb_build_object('days',retention)) ON CONFLICT(key) DO UPDATE SET value=excluded.value; RETURN jsonb_build_object('success',true);
 WHEN 'sweep' THEN
   IF p_actor IS NOT NULL THEN u:=yunost.member(p_actor,true); IF u.role NOT IN('owner','coowner') THEN PERFORM yunost.fail('PT403','Очистку запускают владелец и совладелец.'); END IF; END IF;
   SELECT coalesce((value->>'days')::integer,0) INTO retention FROM yunost.settings s WHERE s.key='cleanup'; retention:=coalesce(retention,0);
   FOR p IN SELECT * FROM yunost.publications WHERE expires_at<=now()-make_interval(days=>retention) ORDER BY expires_at LIMIT 100 LOOP
    UPDATE yunost.events SET poster_deleted=true WHERE id=p.id;
    UPDATE yunost.media SET delete_after=now() WHERE id IN(SELECT media_id FROM yunost.publication_images WHERE publication_id=p.id);
    DELETE FROM yunost.publications WHERE id=p.id;
   END LOOP;
   DELETE FROM yunost.events x WHERE poster_deleted AND NOT EXISTS(SELECT 1 FROM yunost.event_registrations g WHERE g.event_id=x.id AND g.status='registered');
   RETURN jsonb_build_object('success',true);
 WHEN 'media_claim' THEN
   UPDATE yunost.media SET deleting=true WHERE id IN(SELECT x.id FROM yunost.media x WHERE x.delete_after<=now()
    AND NOT EXISTS(SELECT 1 FROM yunost.publication_images i WHERE i.media_id=x.id)
    AND NOT EXISTS(SELECT 1 FROM yunost.products p WHERE p.image_id=x.id OR p.outfit_id=x.id)
    AND NOT EXISTS(SELECT 1 FROM yunost.purchases p WHERE p.image_id=x.id OR p.outfit_id=x.id) ORDER BY delete_after LIMIT 50);
   RETURN coalesce((SELECT jsonb_agg(id) FROM yunost.media WHERE deleting),'[]');
 WHEN 'media_forget' THEN DELETE FROM yunost.media WHERE id=(d->>'id')::uuid AND deleting; RETURN jsonb_build_object('success',true);
 ELSE PERFORM yunost.fail('PT404','Действие не найдено.');
 END CASE;
 RETURN jsonb_build_object('items',result,'nextCursor',CASE WHEN p_action NOT IN('products','team','leaderboard') AND jsonb_array_length(result)=30 THEN (offset_value+30)::text ELSE NULL END);
EXCEPTION
 WHEN unique_violation THEN PERFORM yunost.fail('PT409','Такая запись уже существует. Обновите страницу.'); RETURN NULL;
 WHEN check_violation OR invalid_text_representation OR not_null_violation OR datetime_field_overflow THEN PERFORM yunost.fail('PT400','Проверьте обязательные поля, числа и даты.'); RETURN NULL;
 WHEN foreign_key_violation THEN PERFORM yunost.fail('PT409','Связанная запись уже изменена или удалена. Обновите страницу.'); RETURN NULL;
END $api$;

DO $seed$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM yunost.settings s WHERE s.key='catalog_seed') THEN
  INSERT INTO yunost.products(id,title,tag,price,category,slot,asset_key,model_key,color) VALUES
   ('panama','Голубая панама','Для солнечных дней',90,'Головные уборы','head','panama','panama','#81bddd'),
   ('glasses','Солнечные очки','Летнее настроение',60,'Аксессуары','eyes','glasses','glasses','#25425b'),
   ('tie','Галстук «Юность»','Часть нашей команды',75,'Аксессуары','neck','tie','tie','#73b5e7'),
   ('scarf','Уютный шарф','Тёплые объятия',120,'Аксессуары','neck','scarf','scarf','#658cb8'),
   ('beanie','Шапка с помпоном','Готов к прохладе',160,'Головные уборы','head','beanie','beanie','#5d99c1'),
   ('hoodie','Худи мечтателя','Для больших открытий',300,'Одежда','body','hoodie','hoodie','#98c7e8');
  INSERT INTO yunost.settings VALUES('catalog_seed','1');
 END IF;
END $seed$;
-- RLS включён даже в закрытой схеме. Рабочий доступ только через серверную функцию.
DO $policies$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='yunost' LOOP EXECUTE format('ALTER TABLE yunost.%I ENABLE ROW LEVEL SECURITY',t.tablename); END LOOP;
END $policies$;
REVOKE ALL ON ALL TABLES IN SCHEMA yunost FROM public,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA yunost FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.yunost_api(text,uuid,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.yunost_api(text,uuid,jsonb) TO service_role;
-- Bucket закрытый: фотографии получает только сервер после проверки прав.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('yunost-media','yunost-media',false,5242880,ARRAY['image/png','image/jpeg','image/webp','model/gltf-binary','application/octet-stream'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
NOTIFY pgrst, 'reload schema';
COMMIT;
